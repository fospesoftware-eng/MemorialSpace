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

function PolicyPage({ title, intro, updated, sections }: PolicyPageProps) {
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

export function TermsAndConditionsPage() {
  return (
    <PolicyPage
      title="Terms & Conditions"
      intro="These terms explain how families, memorial space operators, vendors, partners, and visitors may use MemorialSpace services."
      updated={updatedDate}
      sections={[
        {
          title: "Use of the platform",
          body: [
            "MemorialSpace provides tools for grave search, digital memorials, cemetery operations, marketplace listings, tribute pages, bookings, and related services. You agree to use the platform lawfully, respectfully, and only for its intended memorial, operational, and marketplace purposes.",
            "You are responsible for the accuracy of information you submit, including account details, memorial content, marketplace listings, orders, and organization records.",
          ],
        },
        {
          title: "Accounts and access",
          body: [
            "Some areas require an account. You must keep login details secure and notify us if you believe your account has been used without permission.",
            "Organizations are responsible for assigning appropriate access to their staff and partners. We may suspend access if activity appears unsafe, abusive, fraudulent, or unlawful.",
          ],
        },
        {
          title: "Memorial and user content",
          body: [
            "You keep ownership of content you submit, but grant MemorialSpace permission to host, display, process, and share that content as needed to provide the service.",
            "Content must not be unlawful, misleading, hateful, invasive of privacy, or harmful to grieving families and visitors. We may remove content that violates these terms or creates a safety, legal, or trust concern.",
          ],
        },
        {
          title: "Orders, subscriptions, and services",
          body: [
            "Paid services, subscriptions, marketplace items, and vendor services may have separate prices, availability, taxes, delivery timelines, and fulfilment terms shown at checkout or in a signed agreement.",
            "Organizations and vendors are responsible for meeting their own legal, tax, consumer protection, and service delivery obligations.",
          ],
        },
        {
          title: "Availability and changes",
          body: [
            "We work to keep MemorialSpace reliable, but we do not guarantee uninterrupted access. Maintenance, upgrades, outages, or third-party service issues may affect availability.",
            "We may update features, policies, pricing, and these terms from time to time. Continued use of the platform after updates means you accept the revised terms.",
          ],
        },
        {
          title: "Contact",
          body: [
            "Questions about these terms can be sent through the contact page or to the MemorialSpace support team listed on the site.",
          ],
        },
      ]}
    />
  );
}

export function PrivacyPolicyPage() {
  return (
    <PolicyPage
      title="Privacy Policy"
      intro="This policy describes the information MemorialSpace collects, how it is used, and the choices available to users and organizations."
      updated={updatedDate}
      sections={[
        {
          title: "Information we collect",
          body: [
            "We may collect account information, contact details, organization details, memorial content, tribute submissions, order information, support messages, device data, and usage information.",
            "Memorial records may include names, dates, locations, plot references, photos, biographies, relationships, and family-provided details needed to operate digital memorial and grave search services.",
          ],
        },
        {
          title: "How we use information",
          body: [
            "We use information to provide and improve MemorialSpace, authenticate users, operate memorial pages, process orders, support cemetery and vendor workflows, prevent abuse, and communicate about services.",
            "We may use aggregated or de-identified information to understand usage trends, improve product performance, and support reporting without identifying individual users.",
          ],
        },
        {
          title: "Sharing and disclosure",
          body: [
            "Information may be shared with memorial space operators, authorized account users, vendors, payment providers, hosting providers, support tools, and other service providers that help us operate the platform.",
            "Public memorial pages and public grave search results may be visible to visitors depending on privacy settings, organization choices, and family permissions.",
          ],
        },
        {
          title: "Data choices",
          body: [
            "Users may request access, correction, export, or deletion of eligible personal information. Some records may need to be retained where required for legal, operational, historical, payment, fraud prevention, or cemetery recordkeeping reasons.",
            "Families and organizations can manage certain memorial visibility and account settings inside the platform where those controls are available.",
          ],
        },
        {
          title: "Security and retention",
          body: [
            "We use technical and organizational safeguards designed to protect information. No online service can guarantee absolute security, so users should also keep passwords and account access protected.",
            "We retain information for as long as needed to provide services, comply with obligations, resolve disputes, preserve records, and maintain platform integrity.",
          ],
        },
        {
          title: "Contact",
          body: [
            "Privacy questions or data requests can be sent through the contact page or to the MemorialSpace support team listed on the site.",
          ],
        },
      ]}
    />
  );
}

export function CookiePolicyPage() {
  return (
    <PolicyPage
      title="Cookie Policy"
      intro="This policy explains how MemorialSpace uses cookies and similar technologies to keep the site secure, functional, and useful."
      updated={updatedDate}
      sections={[
        {
          title: "What cookies are",
          body: [
            "Cookies are small files stored on your device. Similar technologies may include local storage, pixels, tags, and device identifiers.",
            "These technologies help remember preferences, maintain sessions, improve performance, and understand how visitors use the site.",
          ],
        },
        {
          title: "Types of cookies we use",
          body: [
            "Essential cookies support login, security, checkout, routing, and core platform functionality. These are needed for the service to work properly.",
            "Preference, analytics, and performance cookies may help remember settings, measure traffic, detect errors, and improve the user experience.",
          ],
        },
        {
          title: "Third-party cookies",
          body: [
            "Some cookies may be set by service providers such as hosting, analytics, payment, support, or embedded content providers. Their use is governed by their own policies as well as our agreements with them.",
          ],
        },
        {
          title: "Managing cookies",
          body: [
            "You can control cookies through your browser settings. Blocking certain cookies may affect login, checkout, account features, saved preferences, and memorial management tools.",
            "Where a cookie banner or preference center is available, you can use it to adjust optional cookie choices.",
          ],
        },
        {
          title: "Updates",
          body: [
            "We may update this Cookie Policy when our technologies, service providers, or legal obligations change.",
          ],
        },
      ]}
    />
  );
}

export function RefundPolicyPage() {
  return (
    <PolicyPage
      title="Refund Policy"
      intro="This policy explains how refunds are handled for MemorialSpace subscriptions, digital services, marketplace purchases, and vendor-provided services."
      updated={updatedDate}
      sections={[
        {
          title: "Subscriptions and software services",
          body: [
            "Subscription fees are generally billed in advance and are non-refundable for periods already started, unless a signed agreement, checkout terms, or applicable law says otherwise.",
            "If a billing error occurs, contact support promptly so we can review the charge and correct eligible mistakes.",
          ],
        },
        {
          title: "Digital memorial services",
          body: [
            "Fees for custom setup, data import, digital memorial creation, QR memorial setup, or similar work may be non-refundable once work has started or the digital deliverable has been made available.",
            "If we cannot deliver a purchased digital service due to an issue within our control, we may offer a correction, replacement, account credit, or refund depending on the situation.",
          ],
        },
        {
          title: "Marketplace products and vendor services",
          body: [
            "Physical products and vendor-provided services may be fulfilled by independent vendors, cemeteries, or partners. Refund eligibility may depend on the vendor policy, product condition, customization, delivery status, and applicable law.",
            "Custom, personalized, perishable, installed, or time-sensitive items may not be refundable once production, delivery, installation, or service scheduling has begun.",
          ],
        },
        {
          title: "How to request a refund",
          body: [
            "Refund requests should include the order number, account email, item or service name, purchase date, and a brief explanation. We may request additional details before making a decision.",
            "Approved refunds are usually returned to the original payment method. Processing times can vary by payment provider and financial institution.",
          ],
        },
        {
          title: "Chargebacks and disputes",
          body: [
            "Please contact support before filing a payment dispute so we can investigate and help resolve the issue. Fraudulent or abusive refund activity may lead to account or purchasing restrictions.",
          ],
        },
      ]}
    />
  );
}
