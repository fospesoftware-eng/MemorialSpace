type PolicySection = {
  title: string;
  body: string[];
};

type PolicyPageProps = {
  title: string;
  intro: string;
  updated: string;
  sections: PolicySection[];
};

const updatedDate = "May 28, 2026";

function PartnerPolicyPage({ title, intro, updated, sections }: PolicyPageProps) {
  return (
    <div className="bg-background">
      <section className="border-b border-border/50 px-4 py-16 sm:py-20">
        <div className="container mx-auto max-w-4xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-primary">
            Terms & Policies
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            {intro}
          </p>
          <p className="mt-6 text-sm text-muted-foreground">Last updated: {updated}</p>
        </div>
      </section>

      <section className="px-4 py-14 sm:py-16">
        <div className="container mx-auto max-w-4xl space-y-10">
          {sections.map((section) => (
            <section key={section.title} className="border-b border-border/40 pb-8 last:border-b-0">
              <h2 className="text-2xl font-semibold tracking-tight">{section.title}</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground sm:text-base">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function PartnerTermsPage() {
  return (
    <PartnerPolicyPage
      title="Partner Terms"
      intro="These partner terms explain how MemorialSpace works with cemeteries, funeral homes, vendors, service providers, referral partners, data partners, and other approved business collaborators."
      updated={updatedDate}
      sections={[
        {
          title: "Partner eligibility and approval",
          body: [
            "Partners must provide accurate business, contact, service, tax, and compliance information when requested. MemorialSpace may review, approve, decline, suspend, or remove partner access where needed to protect families, cemetery operators, visitors, and platform trust.",
            "Approval to use partner tools does not create employment, agency, franchise, joint venture, or exclusive distribution rights unless a separate written agreement clearly says so.",
          ],
        },
        {
          title: "Partner responsibilities",
          body: [
            "Partners are responsible for delivering their services professionally, lawfully, respectfully, and in a way that is appropriate for memorial, funeral, cemetery, tribute, and bereavement-related contexts.",
            "Partners must keep account access secure, maintain accurate listings and availability, honor confirmed commitments, respond to support or customer issues promptly, and avoid misleading, offensive, unsafe, or exploitative conduct.",
          ],
        },
        {
          title: "Listings, referrals, and marketplace activity",
          body: [
            "Partner profiles, services, products, prices, descriptions, images, delivery timelines, and availability must be current and truthful. MemorialSpace may edit formatting, request corrections, or remove listings that are incomplete, misleading, inactive, unsafe, or inconsistent with the platform experience.",
            "Where MemorialSpace provides leads, referrals, booking requests, marketplace orders, or customer introductions, partners may only use that information to respond to the relevant request and provide the agreed service.",
          ],
        },
        {
          title: "Data, privacy, and confidentiality",
          body: [
            "Partners may receive personal, memorial, cemetery, order, booking, or support information. Partners must protect that information, use it only for approved MemorialSpace-related purposes, and comply with applicable privacy, data protection, consumer protection, cemetery, funeral, and business laws.",
            "Partners must not copy, sell, scrape, export, or reuse MemorialSpace data, family information, cemetery records, memorial content, or customer contacts outside the approved workflow without written permission and a lawful basis.",
          ],
        },
        {
          title: "Fees, payments, and taxes",
          body: [
            "Partner fees, commissions, subscription charges, platform service fees, payout timing, refunds, chargebacks, and taxes may be set out in the partner dashboard, checkout flow, marketplace terms, or a separate signed agreement.",
            "Partners are responsible for their own taxes, invoices, licenses, insurance, permits, payment details, and financial records unless a separate written agreement says otherwise.",
          ],
        },
        {
          title: "Brand use and marketing",
          body: [
            "Partners may only use MemorialSpace names, logos, screenshots, badges, links, or marketing claims in the way MemorialSpace approves. Partners must not imply endorsement, certification, official status, or guaranteed results unless that has been confirmed in writing.",
            "MemorialSpace may identify approved partners in directories, marketplace pages, case studies, onboarding materials, customer communications, and promotional materials unless a written agreement restricts that use.",
          ],
        },
        {
          title: "Quality, safety, and disputes",
          body: [
            "MemorialSpace may monitor partner activity, customer feedback, order outcomes, listing quality, and support issues to maintain a respectful and reliable platform. We may request corrective action or temporarily limit partner access during reviews.",
            "Partners should try to resolve customer, cemetery, or vendor disputes in good faith. MemorialSpace may assist with platform-related issues but is not responsible for independent partner promises, workmanship, delivery, legal compliance, or offline services unless expressly agreed in writing.",
          ],
        },
        {
          title: "Suspension, termination, and updates",
          body: [
            "MemorialSpace may suspend or end partner access for policy violations, unsafe activity, fraud risk, repeated complaints, non-payment, inactivity, legal concerns, or misuse of platform data or brand assets.",
            "We may update these Partner Terms as the partner program, marketplace, integrations, legal obligations, or platform features evolve. Continued partner use after updates means the revised terms apply.",
          ],
        },
        {
          title: "Contact",
          body: [
            "Questions about partner registration, listings, referrals, commissions, data use, or these Partner Terms can be sent through the contact page or to the MemorialSpace partnership/support team listed on the site.",
          ],
        },
      ]}
    />
  );
}
