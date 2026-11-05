#![no_std]

//! Abeggi — a friendly IOU ledger. Money moves wallet-to-wallet through the
//! configured token; this contract only keeps the receipt.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env,
    String, Vec,
};

const MAX_NOTE_LEN: u32 = 100;
const MAX_LOANS_PER_USER: u32 = 200;

// ~5s ledgers. Stay under the network's max entry TTL (~31 days).
const LEDGERS_PER_DAY: u32 = 17_280;
const TTL_THRESHOLD: u32 = 7 * LEDGERS_PER_DAY;
const TTL_EXTEND_TO: u32 = 30 * LEDGERS_PER_DAY;

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Status {
    Requested,
    Active,
    Repaid,
    Forgiven,
    Declined,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Loan {
    pub id: u64,
    pub borrower: Address,
    pub lender: Address,
    pub amount: i128,
    pub repaid: i128,
    pub due_date: u64,
    pub note: String,
    pub status: Status,
    pub created_at: u64,
    pub funded_at: u64,
    pub closed_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Record {
    pub loans_taken: u32,
    pub loans_repaid: u32,
    pub repaid_on_time: u32,
    pub total_borrowed: i128,
    pub total_lent: i128,
}

#[contracttype]
pub enum DataKey {
    Token,
    NextId,
    Loan(u64),
    UserLoans(Address),
    Record(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum Error {
    SelfLoan = 1,
    BadAmount = 2,
    BadDueDate = 3,
    NoteTooLong = 4,
    NotFound = 5,
    WrongStatus = 6,
    OverRepay = 7,
    TooManyLoans = 8,
}

#[contract]
pub struct Abeggi;

// ---------- storage helpers ----------

fn load_loan(env: &Env, id: u64) -> Result<Loan, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Loan(id))
        .ok_or(Error::NotFound)
}

fn save_loan(env: &Env, loan: &Loan) {
    let key = DataKey::Loan(loan.id);
    env.storage().persistent().set(&key, loan);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn load_record(env: &Env, user: &Address) -> Record {
    env.storage()
        .persistent()
        .get(&DataKey::Record(user.clone()))
        .unwrap_or_default()
}

fn save_record(env: &Env, user: &Address, record: &Record) {
    let key = DataKey::Record(user.clone());
    env.storage().persistent().set(&key, record);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn user_loans(env: &Env, user: &Address) -> Vec<u64> {
    env.storage()
        .persistent()
        .get(&DataKey::UserLoans(user.clone()))
        .unwrap_or_else(|| Vec::new(env))
}

fn attach_loan(env: &Env, user: &Address, id: u64) -> Result<(), Error> {
    let mut ids = user_loans(env, user);
    if ids.len() >= MAX_LOANS_PER_USER {
        return Err(Error::TooManyLoans);
    }
    ids.push_back(id);
    let key = DataKey::UserLoans(user.clone());
    env.storage().persistent().set(&key, &ids);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    Ok(())
}

fn token_client(env: &Env) -> token::Client<'_> {
    let addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
    token::Client::new(env, &addr)
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

// ---------- contract ----------

#[contractimpl]
impl Abeggi {
    pub fn __constructor(env: Env, token: Address) {
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::NextId, &0u64);
    }

    /// Borrower asks `lender` for `amount`. Returns the new loan id.
    pub fn request(
        env: Env,
        borrower: Address,
        lender: Address,
        amount: i128,
        due_date: u64,
        note: String,
    ) -> Result<u64, Error> {
        borrower.require_auth();

        if borrower == lender {
            return Err(Error::SelfLoan);
        }
        if amount <= 0 {
            return Err(Error::BadAmount);
        }
        let now = env.ledger().timestamp();
        if due_date <= now {
            return Err(Error::BadDueDate);
        }
        if note.len() > MAX_NOTE_LEN {
            return Err(Error::NoteTooLong);
        }

        let id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap_or(0);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        bump_instance(&env);

        attach_loan(&env, &borrower, id)?;
        attach_loan(&env, &lender, id)?;

        let loan = Loan {
            id,
            borrower: borrower.clone(),
            lender: lender.clone(),
            amount,
            repaid: 0,
            due_date,
            note,
            status: Status::Requested,
            created_at: now,
            funded_at: 0,
            closed_at: 0,
        };
        save_loan(&env, &loan);

        env.events().publish(
            (symbol_short!("request"), id),
            (borrower, lender, amount, due_date),
        );
        Ok(id)
    }

    /// Lender approves; funds go lender -> borrower.
    pub fn fund(env: Env, id: u64) -> Result<(), Error> {
        let mut loan = load_loan(&env, id)?;
        loan.lender.require_auth();
        if loan.status != Status::Requested {
            return Err(Error::WrongStatus);
        }

        token_client(&env).transfer(&loan.lender, &loan.borrower, &loan.amount);

        loan.status = Status::Active;
        loan.funded_at = env.ledger().timestamp();
        save_loan(&env, &loan);

        let mut b = load_record(&env, &loan.borrower);
        b.loans_taken += 1;
        b.total_borrowed += loan.amount;
        save_record(&env, &loan.borrower, &b);

        let mut l = load_record(&env, &loan.lender);
        l.total_lent += loan.amount;
        save_record(&env, &loan.lender, &l);

        env.events()
            .publish((symbol_short!("fund"), id), loan.amount);
        Ok(())
    }

    /// Lender says no.
    pub fn decline(env: Env, id: u64) -> Result<(), Error> {
        let mut loan = load_loan(&env, id)?;
        loan.lender.require_auth();
        Self::close_unfunded(&env, &mut loan, Status::Declined)?;
        env.events().publish((symbol_short!("decline"), id), ());
        Ok(())
    }

    /// Borrower withdraws an unfunded request.
    pub fn cancel(env: Env, id: u64) -> Result<(), Error> {
        let mut loan = load_loan(&env, id)?;
        loan.borrower.require_auth();
        Self::close_unfunded(&env, &mut loan, Status::Cancelled)?;
        env.events().publish((symbol_short!("cancel"), id), ());
        Ok(())
    }

    /// Borrower pays back some or all of what's left (borrower -> lender).
    pub fn repay(env: Env, id: u64, amount: i128) -> Result<(), Error> {
        let mut loan = load_loan(&env, id)?;
        loan.borrower.require_auth();
        if loan.status != Status::Active {
            return Err(Error::WrongStatus);
        }
        let remaining = loan.amount - loan.repaid;
        if amount <= 0 {
            return Err(Error::BadAmount);
        }
        if amount > remaining {
            return Err(Error::OverRepay);
        }

        token_client(&env).transfer(&loan.borrower, &loan.lender, &amount);

        loan.repaid += amount;
        let left = loan.amount - loan.repaid;
        if left == 0 {
            let now = env.ledger().timestamp();
            loan.status = Status::Repaid;
            loan.closed_at = now;

            let mut b = load_record(&env, &loan.borrower);
            b.loans_repaid += 1;
            if now <= loan.due_date {
                b.repaid_on_time += 1;
            }
            save_record(&env, &loan.borrower, &b);
        }
        save_loan(&env, &loan);

        env.events()
            .publish((symbol_short!("repay"), id), (amount, left));
        Ok(())
    }

    /// Lender writes off whatever is left.
    pub fn forgive(env: Env, id: u64) -> Result<(), Error> {
        let mut loan = load_loan(&env, id)?;
        loan.lender.require_auth();
        if loan.status != Status::Active {
            return Err(Error::WrongStatus);
        }
        let left = loan.amount - loan.repaid;
        loan.status = Status::Forgiven;
        loan.closed_at = env.ledger().timestamp();
        save_loan(&env, &loan);

        env.events().publish((symbol_short!("forgive"), id), left);
        Ok(())
    }

    // ----- reads -----

    pub fn get_loan(env: Env, id: u64) -> Result<Loan, Error> {
        load_loan(&env, id)
    }

    pub fn loans_of(env: Env, user: Address) -> Vec<u64> {
        user_loans(&env, &user)
    }

    pub fn record_of(env: Env, user: Address) -> Record {
        load_record(&env, &user)
    }

    pub fn token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }
}

impl Abeggi {
    fn close_unfunded(env: &Env, loan: &mut Loan, to: Status) -> Result<(), Error> {
        if loan.status != Status::Requested {
            return Err(Error::WrongStatus);
        }
        loan.status = to;
        loan.closed_at = env.ledger().timestamp();
        save_loan(env, loan);
        Ok(())
    }
}

#[cfg(test)]
extern crate std;
#[cfg(test)]
mod test;
