#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Env, String,
};

const UNIT: i128 = 10_000_000;
const T0: u64 = 1_700_000_000;
const DUE: u64 = T0 + 30 * 86_400;

struct Ctx<'a> {
    env: Env,
    abeggi: AbeggiClient<'a>,
    token: TokenClient<'a>,
    ada: Address,  // borrower
    bayo: Address, // lender
}

fn setup<'a>() -> Ctx<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(T0);

    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token_addr = sac.address();

    let id = env.register(Abeggi, (token_addr.clone(),));
    let abeggi = AbeggiClient::new(&env, &id);
    let token = TokenClient::new(&env, &token_addr);

    let ada = Address::generate(&env);
    let bayo = Address::generate(&env);
    StellarAssetClient::new(&env, &token_addr).mint(&bayo, &(100 * UNIT));
    StellarAssetClient::new(&env, &token_addr).mint(&ada, &(100 * UNIT));

    Ctx { env, abeggi, token, ada, bayo }
}

fn note(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

fn make_request(c: &Ctx, amount: i128) -> u64 {
    c.abeggi
        .request(&c.ada, &c.bayo, &amount, &DUE, &note(&c.env, "Transport"))
}

#[test]
fn request_creates_requested_loan_visible_to_both() {
    let c = setup();
    let id = make_request(&c, 5 * UNIT);
    let loan = c.abeggi.get_loan(&id);
    assert_eq!(loan.status, Status::Requested);
    assert_eq!(loan.amount, 5 * UNIT);
    assert_eq!(loan.repaid, 0);
    assert_eq!(loan.created_at, T0);
    assert_eq!(c.abeggi.loans_of(&c.ada).len(), 1);
    assert_eq!(c.abeggi.loans_of(&c.bayo).len(), 1);
}

#[test]
fn ids_increment() {
    let c = setup();
    assert_eq!(make_request(&c, UNIT), 0);
    assert_eq!(make_request(&c, UNIT), 1);
}

#[test]
fn request_rejects_self_loan() {
    let c = setup();
    let r = c
        .abeggi
        .try_request(&c.ada, &c.ada, &UNIT, &DUE, &note(&c.env, "x"));
    assert_eq!(r, Err(Ok(Error::SelfLoan)));
}

#[test]
fn request_rejects_zero_and_negative_amounts() {
    let c = setup();
    for amt in [0i128, -1] {
        let r = c
            .abeggi
            .try_request(&c.ada, &c.bayo, &amt, &DUE, &note(&c.env, "x"));
        assert_eq!(r, Err(Ok(Error::BadAmount)));
    }
}

#[test]
fn request_rejects_past_or_current_due_date() {
    let c = setup();
    for due in [T0 - 1, T0] {
        let r = c
            .abeggi
            .try_request(&c.ada, &c.bayo, &UNIT, &due, &note(&c.env, "x"));
        assert_eq!(r, Err(Ok(Error::BadDueDate)));
    }
}

#[test]
fn request_rejects_long_note() {
    let c = setup();
    let long = "a".repeat(101);
    let r = c
        .abeggi
        .try_request(&c.ada, &c.bayo, &UNIT, &DUE, &note(&c.env, &long));
    assert_eq!(r, Err(Ok(Error::NoteTooLong)));
    let ok = "a".repeat(100);
    c.abeggi
        .request(&c.ada, &c.bayo, &UNIT, &DUE, &note(&c.env, &ok));
}

#[test]
fn request_caps_loans_per_user() {
    let c = setup();
    for _ in 0..MAX_LOANS_PER_USER {
        make_request(&c, UNIT);
    }
    let r = c
        .abeggi
        .try_request(&c.ada, &c.bayo, &UNIT, &DUE, &note(&c.env, "x"));
    assert_eq!(r, Err(Ok(Error::TooManyLoans)));
}

#[test]
fn fund_moves_money_and_activates() {
    let c = setup();
    let id = make_request(&c, 5 * UNIT);
    c.env.ledger().set_timestamp(T0 + 100);
    c.abeggi.fund(&id);

    let loan = c.abeggi.get_loan(&id);
    assert_eq!(loan.status, Status::Active);
    assert_eq!(loan.funded_at, T0 + 100);
    assert_eq!(c.token.balance(&c.ada), 105 * UNIT);
    assert_eq!(c.token.balance(&c.bayo), 95 * UNIT);
    // the contract never holds funds
    assert_eq!(c.token.balance(&c.abeggi.address), 0);

    let rb = c.abeggi.record_of(&c.ada);
    assert_eq!(rb.loans_taken, 1);
    assert_eq!(rb.total_borrowed, 5 * UNIT);
    assert_eq!(c.abeggi.record_of(&c.bayo).total_lent, 5 * UNIT);
}

#[test]
fn cannot_fund_twice() {
    let c = setup();
    let id = make_request(&c, UNIT);
    c.abeggi.fund(&id);
    assert_eq!(c.abeggi.try_fund(&id), Err(Ok(Error::WrongStatus)));
}

#[test]
fn unknown_loan_is_not_found() {
    let c = setup();
    assert_eq!(c.abeggi.try_get_loan(&99), Err(Ok(Error::NotFound)));
    assert_eq!(c.abeggi.try_fund(&99), Err(Ok(Error::NotFound)));
}

#[test]
fn decline_and_cancel_close_requests() {
    let c = setup();
    let a = make_request(&c, UNIT);
    let b = make_request(&c, UNIT);
    c.abeggi.decline(&a);
    c.abeggi.cancel(&b);
    assert_eq!(c.abeggi.get_loan(&a).status, Status::Declined);
    assert_eq!(c.abeggi.get_loan(&b).status, Status::Cancelled);
    // closed requests cannot be funded
    assert_eq!(c.abeggi.try_fund(&a), Err(Ok(Error::WrongStatus)));
    assert_eq!(c.abeggi.try_fund(&b), Err(Ok(Error::WrongStatus)));
    assert_eq!(c.token.balance(&c.bayo), 100 * UNIT);
}

#[test]
fn cannot_decline_or_cancel_after_funding() {
    let c = setup();
    let id = make_request(&c, UNIT);
    c.abeggi.fund(&id);
    assert_eq!(c.abeggi.try_decline(&id), Err(Ok(Error::WrongStatus)));
    assert_eq!(c.abeggi.try_cancel(&id), Err(Ok(Error::WrongStatus)));
}

#[test]
fn partial_repayments_stay_active_then_repaid() {
    let c = setup();
    let id = make_request(&c, 5 * UNIT);
    c.abeggi.fund(&id);

    c.abeggi.repay(&id, &(2 * UNIT));
    let loan = c.abeggi.get_loan(&id);
    assert_eq!(loan.status, Status::Active);
    assert_eq!(loan.repaid, 2 * UNIT);

    c.env.ledger().set_timestamp(T0 + 500);
    c.abeggi.repay(&id, &(3 * UNIT));
    let loan = c.abeggi.get_loan(&id);
    assert_eq!(loan.status, Status::Repaid);
    assert_eq!(loan.closed_at, T0 + 500);
    // net zero for both after full round trip
    assert_eq!(c.token.balance(&c.ada), 100 * UNIT);
    assert_eq!(c.token.balance(&c.bayo), 100 * UNIT);

    let r = c.abeggi.record_of(&c.ada);
    assert_eq!(r.loans_repaid, 1);
    assert_eq!(r.repaid_on_time, 1);
}

#[test]
fn late_repayment_is_not_on_time() {
    let c = setup();
    let id = make_request(&c, UNIT);
    c.abeggi.fund(&id);
    c.env.ledger().set_timestamp(DUE + 1);
    c.abeggi.repay(&id, &UNIT);
    let r = c.abeggi.record_of(&c.ada);
    assert_eq!(r.loans_repaid, 1);
    assert_eq!(r.repaid_on_time, 0);
}

#[test]
fn repaying_exactly_on_due_date_counts_as_on_time() {
    let c = setup();
    let id = make_request(&c, UNIT);
    c.abeggi.fund(&id);
    c.env.ledger().set_timestamp(DUE);
    c.abeggi.repay(&id, &UNIT);
    assert_eq!(c.abeggi.record_of(&c.ada).repaid_on_time, 1);
}

#[test]
fn repay_rejects_over_repayment_and_bad_amounts() {
    let c = setup();
    let id = make_request(&c, 5 * UNIT);
    c.abeggi.fund(&id);
    c.abeggi.repay(&id, &(4 * UNIT));
    assert_eq!(
        c.abeggi.try_repay(&id, &(2 * UNIT)),
        Err(Ok(Error::OverRepay))
    );
    assert_eq!(c.abeggi.try_repay(&id, &0), Err(Ok(Error::BadAmount)));
    assert_eq!(c.abeggi.try_repay(&id, &-5), Err(Ok(Error::BadAmount)));
}

#[test]
fn repay_requires_active_loan() {
    let c = setup();
    let id = make_request(&c, UNIT);
    assert_eq!(c.abeggi.try_repay(&id, &UNIT), Err(Ok(Error::WrongStatus)));
    c.abeggi.fund(&id);
    c.abeggi.repay(&id, &UNIT);
    // already repaid
    assert_eq!(c.abeggi.try_repay(&id, &UNIT), Err(Ok(Error::WrongStatus)));
}

#[test]
fn forgive_closes_active_loan_without_moving_money() {
    let c = setup();
    let id = make_request(&c, 5 * UNIT);
    c.abeggi.fund(&id);
    c.abeggi.repay(&id, &UNIT);
    let before = c.token.balance(&c.ada);
    c.abeggi.forgive(&id);

    let loan = c.abeggi.get_loan(&id);
    assert_eq!(loan.status, Status::Forgiven);
    assert_eq!(c.token.balance(&c.ada), before);
    assert_eq!(c.abeggi.record_of(&c.ada).loans_repaid, 0);
    assert_eq!(c.abeggi.try_repay(&id, &UNIT), Err(Ok(Error::WrongStatus)));
}

#[test]
fn cannot_forgive_unfunded_or_closed_loan() {
    let c = setup();
    let id = make_request(&c, UNIT);
    assert_eq!(c.abeggi.try_forgive(&id), Err(Ok(Error::WrongStatus)));
    c.abeggi.fund(&id);
    c.abeggi.repay(&id, &UNIT);
    assert_eq!(c.abeggi.try_forgive(&id), Err(Ok(Error::WrongStatus)));
}

// ---- authorization: each action must be signed by the right party ----

fn first_auth_addr(env: &Env) -> Address {
    env.auths().first().unwrap().0.clone()
}

#[test]
fn each_action_requires_the_right_signer() {
    let c = setup();
    let id = c
        .abeggi
        .request(&c.ada, &c.bayo, &(5 * UNIT), &DUE, &note(&c.env, "x"));
    assert_eq!(first_auth_addr(&c.env), c.ada);

    c.abeggi.fund(&id);
    assert_eq!(first_auth_addr(&c.env), c.bayo);

    c.abeggi.repay(&id, &UNIT);
    assert_eq!(first_auth_addr(&c.env), c.ada);

    c.abeggi.forgive(&id);
    assert_eq!(first_auth_addr(&c.env), c.bayo);

    let id2 = make_request(&c, UNIT);
    c.abeggi.decline(&id2);
    assert_eq!(first_auth_addr(&c.env), c.bayo);

    let id3 = make_request(&c, UNIT);
    c.abeggi.cancel(&id3);
    assert_eq!(first_auth_addr(&c.env), c.ada);
}

#[test]
fn token_is_exposed() {
    let c = setup();
    assert_eq!(c.abeggi.token(), c.token.address);
}
