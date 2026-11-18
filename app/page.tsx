import { Faq } from "./_components/Faq";
import { Footer } from "./_components/Footer";
import { Header } from "./_components/Header";
import { Hero } from "./_components/Hero";
import { HowItWorks } from "./_components/HowItWorks";
import { FinderSection } from "./_sections/finder/Section";
import { LiveSection } from "./_sections/live/Section";
import { WaitlistSection } from "./_sections/waitlist/Section";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <LiveSection />
        <FinderSection searchParams={searchParams} />
        <HowItWorks />
        <WaitlistSection />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
