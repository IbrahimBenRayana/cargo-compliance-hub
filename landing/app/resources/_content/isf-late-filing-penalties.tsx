import * as React from "react";
import Link from "next/link";
import { ROUTES, ctaHref } from "@/lib/site";
import { Answer, DataTable, Ext, HouseBillFigure, ProductBox } from "../_components/prose";
import type { Article } from "./types";

/**
 * Article 01, verbatim from
 * marketing/deliverables/2026-10-23-foundation-gtm-kit/article-01.md
 * (rev 2026-10-26, bible v3). Internal links re-pointed to the new routes per
 * site-architecture §3: /platform/filings → /platform/isf-filing,
 * /platform/automation → /platform/inbox, /platform/ai → /platform/pre-filing-checks,
 * and /pricing → /pricing#volume (NVOCC context, §7.3).
 *
 * STATUS: awaiting review. The article header asks for a licensed customs
 * broker or customs attorney to read it before publishing, so the route is
 * noindex and the article is not listed on /resources or
 * llms.txt. Flip `status` to "published" and set `datePublished` once the
 * review is done.
 */

const GUIDELINES =
  "https://www.cbp.gov/sites/default/files/assets/documents/2020-Feb/Mitigation-Guidelines-10+2-2018.pdf";
const FAQ_PDF = "https://www.cbp.gov/sites/default/files/assets/documents/2023-May/ISF%20FAQ%202.0%20(508).pdf";
const TRADE_STATS = "https://www.cbp.gov/newsroom/stats/trade";
const CFR_149_1 = "https://www.law.cornell.edu/cfr/text/19/149.1";
const CFR_149_2 = "https://www.law.cornell.edu/cfr/text/19/149.2";
const CFR_149_5 = "https://www.law.cornell.edu/cfr/text/19/149.5";
const RELEASE_2013 = "https://www.cbp.gov/newsroom/national-media-release/cbp-enters-next-phase-importer-security-filing";

function Body() {
  return (
    <>
      <p>
        A late Importer Security Filing can cost $5,000. Under CBP&apos;s liquidated-damages guidelines, a Port Director
        may assess a $5,000 claim for each late ISF, each inaccurate ISF, the first inaccurate update, and each failure
        to withdraw an ISF (<Ext href={GUIDELINES}>CBP mitigation guidelines, §IV.B</Ext>). The claim is made against
        the bond that secured the filing. For an NVOCC filing at the house-bill level, every house bill is its own ISF,
        so the exposure grows with every consolidation.
      </p>
      <p>
        CBP is also issuing more of these claims. Its trade statistics show total trade liquidated damages rose from
        22,399 in FY2024 to 53,052 in FY2025 (<Ext href={TRADE_STATS}>CBP trade statistics</Ext>). That figure covers
        all trade liquidated damages, not ISF alone, but the direction is clear.
      </p>
      <p>
        This guide walks through what triggers an ISF claim, who is liable, what mitigation usually looks like, and the
        habits that keep an ISF desk out of trouble. Everything regulatory below links to CBP or the Code of Federal
        Regulations. It is general information, not legal advice.
      </p>

      <h2 id="on-time">What &ldquo;on time&rdquo; means for an ISF</h2>
      <Answer>
        An ISF-10 is on time when its core data reaches CBP{" "}
        <strong>no later than 24 hours before the cargo is laden on the vessel at the foreign port</strong> (
        <Ext href={CFR_149_2}>19 CFR 149.2(b)</Ext>). That covers seller, buyer, importer of record number, consignee
        number, manufacturer or supplier, ship-to party, country of origin and HTSUS number.
      </Answer>
      <ProductBox
        body="Every ISF gets a deadline clock with alerts at 72, 48 and 24 hours before it."
        linkLabel="The ISF deadline clock"
        href={ROUTES.inbox.href}
      />
      <p>
        Two elements get more time. Container stuffing location and consolidator are due as early as possible and no
        later than 24 hours before arrival at the first U.S. port. For FROB cargo, the ISF-5 is due before lading at the
        foreign port.
      </p>
      <p>
        The four &ldquo;flexible&rdquo; elements (manufacturer, ship-to party, country of origin, HTSUS) can be filed on
        best available data, then must be updated no later than 24 hours before arrival (
        <Ext href={CFR_149_2}>19 CFR 149.2(f)</Ext>). CBP&apos;s FAQ adds that the ISF must match a bill of lading in
        ACE at least 24 hours before arrival at the first U.S. port (
        <Ext href={FAQ_PDF}>CBP ISF FAQ, May 2023, Bills of Lading Q2</Ext>).
      </p>
      <p>
        CBP has assessed ISF liquidated damages since July 9, 2013 (
        <Ext href={RELEASE_2013}>CBP release, June 7, 2013</Ext>).
      </p>

      <h2 id="triggers">The five ways an ISF becomes a claim</h2>
      <Answer>
        CBP&apos;s guidelines name six violations: failing to file, filing late, filing inaccurately, failing to update,
        submitting an inaccurate update, and failing to withdraw (<Ext href={GUIDELINES}>§IV.A</Ext>). In practice they
        produce five outcomes:
      </Answer>
      <DataTable
        caption="The five ways an ISF becomes a claim"
        head={["Trigger", "What CBP may do", "Source"]}
        rows={[
          ["Late ISF", "$5,000 liquidated-damages claim per late ISF", "Guidelines §IV.B.2"],
          [
            "Inaccurate ISF",
            "$5,000 per inaccurate ISF. CBP judges the last transmission before the applicable deadline",
            "Guidelines §IV.B.3",
          ],
          ["Inaccurate update", "$5,000 for the first inaccurate update", "Guidelines §IV.B.4"],
          [
            <>
              Failure to withdraw
              <span className="mt-1 block text-[13px] font-normal text-tone-muted">(shipment cancelled, ISF left open)</span>
            </>,
            "$5,000",
            "Guidelines §IV.B.5; 19 CFR 149.2(e)",
          ],
          [
            "No ISF at all",
            "No liquidated damages if no bond is in place, but CBP withholds release of the cargo until it gets the ISF, may limit unlading, and cargo unladen without permission may be seized",
            "Guidelines §IV.B.1 and §IV.F",
          ],
        ]}
      />
      <p>
        &ldquo;Inaccurate&rdquo; is broader than a typo. CBP&apos;s examples include no bill-of-lading match, failing to
        close a flexible filing with a CT update at least 24 hours before arrival, and HTS discrepancies at the 6-digit
        level found at inspection (<Ext href={FAQ_PDF}>CBP ISF FAQ, Amendments Q6</Ext>). One transmission can draw more
        than one claim: the FAQ lists $5,000 per late ISF, $5,000 per inaccurate ISF and $5,000 for the first inaccurate
        update (<Ext href={FAQ_PDF}>Liquidated Damages Q1</Ext>).
      </p>

      <h2 id="who-pays">Who pays: the ISF Importer, the agent, or the NVOCC</h2>
      <Answer>
        Liability follows the <strong>ISF Importer</strong>, defined as &ldquo;the party causing goods to arrive within
        the limits of a port in the United States by vessel&rdquo; (<Ext href={CFR_149_1}>19 CFR 149.1</Ext>). Who that
        is depends on the shipment:
      </Answer>
      <ul>
        <li>
          <strong>Regular imports (ISF-10):</strong> the goods&apos; owner, purchaser, consignee, or an agent such as a
          licensed customs broker.
        </li>
        <li>
          <strong>FROB (ISF-5):</strong> the carrier or the NVOCC. CBP&apos;s FAQ is direct: if the NVOCC issues the
          house bill and fails to file the ISF-5, &ldquo;The NVOCC is liable,&rdquo; and that applies to foreign NVOCCs
          too (<Ext href={FAQ_PDF}>ISF-5 section, Q3 and Q4</Ext>).
        </li>
        <li>
          <strong>IE, T&amp;E and FTZ shipments:</strong> the owner, purchaser or consignee, and the party filing the
          IE, T&amp;E or FTZ documents may also act as ISF Importer.
        </li>
      </ul>
      <p>
        When an NVOCC or forwarder files an ISF-10 <strong>as agent</strong>, the ISF Importer stays responsible for a
        timely, accurate filing. The exception is the bond. Every ISF must be secured by a bond, and if the importer has
        none, the agent can post its own (<Ext href={CFR_149_5}>19 CFR 149.5(b)</Ext>). An agent who does that
        &ldquo;agrees to have his bond charged if there are breaches&rdquo; (<Ext href={FAQ_PDF}>Bonds Q2</Ext>). Many
        forwarders also pass claims back to the importer by contract, so read your own terms.
      </p>
      <p>
        A filing agent does not need a customs broker license, and a foreign freight forwarder can act as one. A unified
        entry filing is the exception (<Ext href={FAQ_PDF}>Agents Q5</Ext>).
      </p>

      <h2 id="consolidations">Why exposure multiplies on consolidations</h2>
      <Answer>
        CBP requires the ISF &ldquo;at the lowest bill of lading level,&rdquo; meaning the house bill or a regular bill,
        never the master (<Ext href={FAQ_PDF}>Bills of Lading Q3</Ext>). On a consolidation, each house bill is its own
        ISF.
      </Answer>
      <HouseBillFigure />
      <p>
        The arithmetic follows. If a shipper&apos;s documents arrive late and five house-bill ISFs on one container go in
        after the cutoff, that is five possible $5,000 claims, or $25,000 of exposure before mitigation. One late
        supplier can turn a single container into a five-figure problem.
      </p>

      <h2 id="mitigation">What mitigation usually looks like</h2>
      <Answer>
        A claim is not the final bill. Under the guidelines, a first late or inaccurate ISF claim may be cancelled on
        payment of <strong>$1,000 to $2,000</strong>. Later violations may be cancelled for{" "}
        <strong>not less than $2,500</strong>. No relief is given if CBP decides law-enforcement goals were compromised (
        <Ext href={GUIDELINES}>§IV.D</Ext>).
      </Answer>
      <p>CBP lists these mitigating factors (§IV.E):</p>
      <ul>
        <li>few violations compared with the number of ISFs required;</li>
        <li>certified Tier 2 or Tier 3 C-TPAT membership (up to 50% additional mitigation);</li>
        <li>demonstrated remedial action;</li>
        <li>late filing caused by a vessel diversion outside your control, such as weather.</li>
      </ul>
      <p>
        An &ldquo;extraordinary&rdquo; factor may cancel a claim without payment: the data came from another party under
        ordinary commercial practice, you reasonably believed it, and you could not reasonably verify it. Aggravating
        factors include multiple errors on the ISF and &ldquo;a rising error rate.&rdquo; CBP can also cancel a claim in
        full when it was issued in error, for example a bill-of-lading mismatch caused by an ACE issue (
        <Ext href={FAQ_PDF}>Liquidated Damages Q2</Ext>).
      </p>
      <p>
        Keep records for a long time. The statute of limitations for ISF liquidated damages is six years from the breach
        of the bond (28 U.S.C. 2415, per <Ext href={FAQ_PDF}>Bonds Q14</Ext>). For a petition, talk to your customs
        broker or a customs attorney.
      </p>

      <h2 id="checklist">A checklist for ISF desks</h2>
      <ol>
        <li>
          <strong>Set the deadline per house bill at booking.</strong> The clock is 24 hours before lading at the foreign
          port, per bill.
        </li>
        <li>
          <strong>Chase supplier data early.</strong> Use flexible filing only for the four elements the rule allows, and
          close it with a CT update more than 24 hours before arrival.
        </li>
        <li>
          <strong>Treat &ldquo;Accepted&rdquo; as half done.</strong> CBP says an accepted message &ldquo;does not
          indicate that the ISF has been finalized or is accurate.&rdquo; If you get &ldquo;Accepted, No Bill on
          File,&rdquo; check the bill number and type, and don&apos;t send a replace just to force a match. CBP warns that
          can hurt your compliance profile (<Ext href={FAQ_PDF}>Bills of Lading Q5</Ext>).
        </li>
        <li>
          <strong>Rolled cargo:</strong> no amendment needed if the bill of lading doesn&apos;t change (
          <Ext href={FAQ_PDF}>Amendments Q8</Ext>).
        </li>
        <li>
          <strong>Withdraw cancelled shipments.</strong> An open ISF for cargo that never sails is a $5,000 trigger.
        </li>
        <li>
          <strong>Compare the ISF&apos;s 6-digit HTS with the entry.</strong> Mismatches at inspection count as
          inaccurate.
        </li>
        <li>
          <strong>Log when data arrived and from whom.</strong> That record supports the &ldquo;reasonably
          believed&rdquo; mitigating factor and proves remedial action.
        </li>
        <li>
          <strong>Watch your error rate monthly.</strong> A rising rate is an aggravating factor.
        </li>
      </ol>

      <h2 id="software">Where software fits</h2>
      <Answer>
        A deadline is easy to lose across email, spreadsheets and a filing screen.{" "}
        <Link href={ROUTES.isfFiling.href}>MyCargoLens</Link> is ISF and customs entry software built for that problem:
      </Answer>
      <ul>
        <li>
          <strong>A deadline clock on every ISF</strong>, computed 24 hours before lading, with alerts at 72, 48 and 24
          hours before it (<Link href={ROUTES.inbox.href}>the inbox</Link>).
        </li>
        <li>
          <strong>One inbox ranked by urgency</strong>, so the house bill closest to its cutoff sits at the top.
        </li>
        <li>
          <strong>Rule-based checks on every draft before submit</strong>, plus an optional AI pre-flight review.
        </li>
        <li>
          <strong>CBP responses picked up every minute</strong>, any transmission CBP hasn&apos;t answered flagged, and
          rejections explained in plain English with numbered fix steps (
          <Link href={ROUTES.preFilingChecks.href}>pre-filing checks</Link>).
        </li>
        <li>
          <strong>
            Filed directly with CBP, with every CBP request and response logged.
          </strong>{" "}
          That log gives you the timeline a petition needs.
        </li>
        <li>
          <strong>Templates, bulk submit and a REST API with signed webhooks</strong>, so ISFs can come straight from
          your TMS.
        </li>
      </ul>
      <p>
        It won&apos;t make a late shipper send data sooner, and it doesn&apos;t replace your broker&apos;s judgment on a
        petition. It makes sure nobody on your team is surprised by a cutoff. For NVOCCs and forwarders,{" "}
        <Link href={`${ROUTES.pricing.href}#volume`}>volume pricing is on request</Link>, and we&apos;re taking a small
        number of design partners.
      </p>
      <p>
        <strong>
          <Link href={ctaHref({ persona: "nvocc", src: "article-isf-late-filing-penalties" })} data-cta-id="book_demo" data-location="inline">
            Book a 20-minute demo
          </Link>
        </strong>{" "}
        and we&apos;ll walk through your ISF flow with a live deadline clock.
      </p>
    </>
  );
}

export const isfLateFilingPenalties: Article = {
  slug: "isf-late-filing-penalties",
  status: "awaiting-review",
  topic: "isf",
  kind: "Guide",
  title: "ISF late filing penalties: what triggers liquidated damages and how NVOCC ISF desks stay on time",
  shortTitle: "ISF late filing penalties",
  metaTitle: "ISF Late Filing Penalties: What Triggers a $5,000 Claim",
  metaDescription:
    "A late, inaccurate or unwithdrawn ISF can draw a $5,000 liquidated-damages claim. What triggers one, who pays, and how NVOCC ISF desks stay on time.",
  dek: "A late, inaccurate or unwithdrawn ISF can draw a $5,000 liquidated-damages claim. What triggers one, who pays, and how NVOCC ISF desks stay on time.",
  datePublished: null,
  dateReviewed: "2026-10-23",
  readingMinutes: 8,
  toc: [
    { id: "on-time", label: "What “on time” means for an ISF" },
    { id: "triggers", label: "The five ways an ISF becomes a claim" },
    { id: "who-pays", label: "Who pays: the ISF Importer, the agent, or the NVOCC" },
    { id: "consolidations", label: "Why exposure multiplies on consolidations" },
    { id: "mitigation", label: "What mitigation usually looks like" },
    { id: "checklist", label: "A checklist for ISF desks" },
    { id: "software", label: "Where software fits" },
    { id: "faq", label: "FAQ" },
    { id: "sources", label: "Sources" },
  ],
  faq: [
    {
      q: "How much is the penalty for a late ISF?",
      a: "CBP may assess $5,000 in liquidated damages per late ISF. A first violation may be cancelled for $1,000 to $2,000 if law-enforcement goals were not compromised; later ones for not less than $2,500.",
    },
    {
      q: "When is an ISF-10 considered late?",
      a: "When the core data elements reach CBP less than 24 hours before the cargo is laden at the foreign port. Stuffing location and consolidator may follow, up to 24 hours before U.S. arrival.",
    },
    {
      q: "Is the NVOCC or the importer liable for a late ISF?",
      a: "The ISF Importer is liable. For FROB cargo on an NVOCC's house bill, that is the NVOCC. For ISF-10s filed by an agent, liability stays with the importer unless the agent posted its own bond.",
    },
    {
      q: "Can CBP penalize an ISF that was never filed?",
      a: "Not with liquidated damages if no bond was in place. CBP will hold the cargo until the ISF arrives and may limit unlading or seize cargo unladen without permission.",
    },
    {
      q: "How long can CBP pursue an ISF claim?",
      a: "Six years from the breach of the bond, according to CBP's ISF FAQ.",
    },
  ],
  sources: [
    {
      label:
        "CBP, Mitigation Guidelines: Vessel Stow Plan, Container Status Message, and Importer Security Filing Requirements (based on CBP Dec. 09-26), §IV",
      href: GUIDELINES,
    },
    {
      label:
        "CBP, Frequently Asked Questions: Importer Security Filing and Additional Carrier Requirements, May 2023 (Pub. 3204-0523)",
      href: FAQ_PDF,
    },
    { label: "CBP, Trade statistics, “Total Trade Liquidated Damages” (accessed Oct 23, 2026)", href: TRADE_STATS },
    { label: "CBP, “CBP Enters Next Phase of Importer Security Filing,” June 7, 2013", href: RELEASE_2013 },
    { label: "19 CFR 149.1, 149.2, 149.3, 149.5, via Cornell LII", href: "https://www.law.cornell.edu/cfr/text/19/part-149" },
    { label: "19 CFR 113.62(j), via Cornell LII", href: "https://www.law.cornell.edu/cfr/text/19/113.62" },
  ],
  related: ["isf-10-2-guide", "who-files-the-isf", "house-bill-isf"],
  Body,
};
