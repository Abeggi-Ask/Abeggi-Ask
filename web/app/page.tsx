import Link from "next/link";
import { HandCoins, HeartHandshake, Star } from "lucide-react";

const STEPS = [
  { icon: HandCoins, title: "Ask", body: "Pick a friend, an amount and a due date. They get a link." },
  { icon: HeartHandshake, title: "Agree", body: "They approve and the money goes straight to you, wallet to wallet." },
  { icon: Star, title: "Repay", body: "Pay back all at once or small small. Everyone sees the same record." },
];

export default function Landing() {
  return (
    <>
      <section className="pt-10 sm:pt-16">
        <h1 className="text-5xl font-black leading-[1.05] sm:text-6xl">
          Borrow from friends <span className="underline decoration-marigold-500 decoration-8 underline-offset-4">without the awkwardness.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-plum-700">
          No more “abeg, when you go pay?” and no more “I don’t remember you lent me.” One shared record of
          what’s owed, what’s paid, and when it’s due.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/request" className="btn-primary">Ask a friend</Link>
          <Link href="/dashboard" className="btn-plain">See my loans</Link>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <div key={title} className="panel p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-marigold-500 text-plum-950">
              <Icon size={20} />
            </div>
            <h3 className="mt-4 text-xl font-bold">{i + 1}. {title}</h3>
            <p className="mt-1 text-sm text-plum-700">{body}</p>
          </div>
        ))}
      </section>

      <p className="mt-12 rounded-2xl bg-plum-900 p-5 text-sm text-paper">
        Abeggi never holds your money, it only keeps the receipt. It can’t force anyone to pay, it just makes
        sure nobody has to argue about what was agreed.
      </p>
    </>
  );
}
