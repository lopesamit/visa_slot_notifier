import type { AppointmentKind, PostId, VisaClassId } from "@visa-slot/shared";

export type MaritalStatus = "single" | "married" | "divorced";

export type DocNeed = "must" | "usually" | "if-applies";

export type DocItem = {
  title: string;
  note?: string;
  need: DocNeed;
  visas?: VisaClassId[];
  marital?: MaritalStatus[];
  kinds?: AppointmentKind[];
  posts?: PostId[];
};

export const NEED_LABEL: Record<DocNeed, string> = {
  must: "Bring this",
  usually: "Usually asked",
  "if-applies": "If it applies",
};

export const MARITAL_OPTIONS: { id: MaritalStatus; label: string }[] = [
  { id: "single", label: "Single" },
  { id: "married", label: "Married" },
  { id: "divorced", label: "Divorced or widowed" },
];

export const APPOINTMENT_OPTIONS: { id: AppointmentKind | "both"; label: string }[] = [
  { id: "both", label: "Both appointments" },
  { id: "ofc", label: "OFC / VAC only" },
  { id: "consular", label: "Consular interview only" },
];

const all: DocItem[] = [
  {
    title: "Current passport",
    need: "must",
    note: "Must be valid at least six months beyond the day you plan to enter the United States. Bring the original.",
  },
  {
    title: "All old passports",
    need: "must",
    note: "Especially any passport that ever had a U.S. visa. Officers often ask to see the full travel history.",
  },
  {
    title: "DS-160 confirmation page",
    need: "must",
    note: "Print the page with the barcode. It must be the same DS-160 used to book the appointment. Each traveler, including children, needs their own.",
  },
  {
    title: "Visa fee (MRV) receipt",
    need: "must",
    note: "The payment confirmation from the scheduling site. Fees are not refunded if you miss the appointment.",
  },
  {
    title: "Appointment confirmation letter",
    need: "must",
    note: "The printout from usvisascheduling.com for that day’s visit (OFC and/or consular).",
  },
  {
    title: "Corrected DS-160 pages, if you updated the form after booking",
    need: "if-applies",
    note: "If you changed the DS-160 after the appointment was booked, bring both the original confirmation used to book and the new one.",
  },
  {
    title: "Name-change documents",
    need: "if-applies",
    note: "Gazette, marriage certificate, or affidavit if your name differs across the passport, DS-160, I-797, I-20, or degree.",
  },
  {
    title: "One U.S.-format photo",
    need: "if-applies",
    kinds: ["ofc"],
    note: "2×2 inches (51×51 mm), white background, taken in the last six months. The OFC usually photographs you there. Carry a spare if the DS-160 photo upload failed.",
  },
  {
    title: "Letter for a medical device",
    need: "if-applies",
    note: "U.S. Mission India asks for a hard-copy letter from a doctor if you must bring a medical device into the consular section.",
  },

  {
    title: "Form I-797 approval notice",
    need: "must",
    visas: ["h1b", "h4", "l1l2"],
    kinds: ["consular"],
    note: "Original or a clear copy of the current approval. For H-1B renewals, also bring earlier I-797s if you have them.",
  },
  {
    title: "Labor Condition Application (LCA)",
    need: "usually",
    visas: ["h1b", "h4"],
    kinds: ["consular"],
    note: "The Department of Labor certified LCA that matches the petition.",
  },
  {
    title: "Employer support letter",
    need: "must",
    visas: ["h1b", "l1l2"],
    kinds: ["consular"],
    note: "On company letterhead: your job title, salary, start date, work location, and a short description of duties. Should be recent (often within 30 days).",
  },
  {
    title: "Offer letter or employment agreement",
    need: "usually",
    visas: ["h1b", "l1l2"],
    kinds: ["consular"],
  },
  {
    title: "Résumé or CV",
    need: "usually",
    visas: ["h1b", "l1l2"],
    kinds: ["consular"],
  },
  {
    title: "Degree certificates and mark sheets / transcripts",
    need: "must",
    visas: ["h1b", "l1l2", "f1f2"],
    kinds: ["consular"],
    note: "Originals plus copies. Include the bachelor’s degree that qualifies the H-1B or L role, or the records the school used for the I-20.",
  },
  {
    title: "Credential evaluation",
    need: "if-applies",
    visas: ["h1b", "l1l2"],
    kinds: ["consular"],
    note: "Bring this if your degree title does not obviously match the job, or if the petition used an evaluation.",
  },
  {
    title: "Experience letters from past employers",
    need: "usually",
    visas: ["h1b", "l1l2"],
    kinds: ["consular"],
  },
  {
    title: "End-client letter (if you work at a client site)",
    need: "usually",
    visas: ["h1b", "l1l2"],
    kinds: ["consular"],
    note: "From the client: your role, dates, who supervises you, and that the project is real. Common for IT consulting cases in India.",
  },
  {
    title: "Recent U.S. pay stubs, W-2s, and tax returns",
    need: "if-applies",
    visas: ["h1b", "h4", "l1l2"],
    kinds: ["consular"],
    note: "If you or the principal already work in the U.S.: last 3–6 pay stubs, last 1–2 years of W-2s, and Form 1040.",
  },
  {
    title: "I-94 arrival / departure record",
    need: "if-applies",
    visas: ["h1b", "h4", "l1l2", "f1f2"],
    kinds: ["consular"],
    note: "Print from the CBP I-94 site if you have already entered the U.S. on this status.",
  },

  {
    title: "Copy of the H-1B principal’s I-797 and visa",
    need: "must",
    visas: ["h4"],
    kinds: ["consular"],
    note: "Plus the bio pages of the principal’s passport. H-4 stands on the principal’s approved petition.",
  },
  {
    title: "Letter confirming the principal’s current job",
    need: "must",
    visas: ["h4"],
    kinds: ["consular"],
    note: "From the H-1B employer: still employed, title, and salary. If the principal is in the U.S., add their recent pay stubs.",
  },

  {
    title: "Form I-129S and blanket L approval (blanket L-1)",
    need: "if-applies",
    visas: ["l1l2"],
    kinds: ["consular"],
    note: "For blanket L cases. U.S. Mission India has long processed blanket L-1 interviews in Chennai. Confirm the city on your appointment letter.",
  },
  {
    title: "Proof the companies are related",
    need: "must",
    visas: ["l1l2"],
    kinds: ["consular"],
    note: "Org chart, ownership documents, and a letter describing the qualifying relationship and your role abroad and in the U.S.",
  },
  {
    title: "Proof you worked one year abroad",
    need: "must",
    visas: ["l1l2"],
    kinds: ["consular"],
    note: "Pay slips, appointment letter, and experience letter covering at least one continuous year in the last three years for the related company.",
  },

  {
    title: "Form I-20 (F-1 or F-2)",
    need: "must",
    visas: ["f1f2"],
    kinds: ["consular"],
    note: "Signed by the school DSO and by you. F-2 dependents need their own I-20. Check that names and SEVIS ID match the DS-160.",
  },
  {
    title: "SEVIS I-901 fee receipt",
    need: "must",
    visas: ["f1f2"],
    kinds: ["consular"],
    note: "Printed confirmation that the I-901 was paid for this SEVIS ID.",
  },
  {
    title: "Proof you can pay for school",
    need: "must",
    visas: ["f1f2"],
    kinds: ["consular"],
    note: "Bank statements, education loan letter, sponsor affidavit plus the sponsor’s statements, or scholarship letter. Should cover the amount on the I-20.",
  },
  {
    title: "Admission letter and school correspondence",
    need: "usually",
    visas: ["f1f2"],
    kinds: ["consular"],
  },
  {
    title: "Proof you will return to India after studies",
    need: "usually",
    visas: ["f1f2"],
    kinds: ["consular"],
    note: "Family ties, property, a job waiting, or a clear plan. F visas are single-intent.",
  },

  {
    title: "Proof of why you are traveling",
    need: "must",
    visas: ["b1b2"],
    kinds: ["consular"],
    note: "B-1: invitation, conference registration, or company letter describing meetings. B-2: itinerary, hotel bookings, or a family invitation with the host’s status in the U.S.",
  },
  {
    title: "Leave letter and proof you will return to work",
    need: "usually",
    visas: ["b1b2"],
    kinds: ["consular"],
    note: "Employer letter: role, salary, approved leave dates, and that your job continues. If self-employed, bring business registration and recent returns.",
  },
  {
    title: "Bank statements and Indian tax returns",
    need: "usually",
    visas: ["b1b2"],
    kinds: ["consular"],
    note: "About six months of statements and two to three years of ITRs. Officers look for stable ties, not a huge last-minute deposit.",
  },
  {
    title: "Property or family documents that show ties to India",
    need: "usually",
    visas: ["b1b2"],
    kinds: ["consular"],
    note: "House papers, a dependent family remaining in India, or similar. Not required by a fixed rule, but often asked.",
  },

  {
    title: "Marriage certificate",
    need: "must",
    marital: ["married"],
    kinds: ["consular"],
    visas: ["h4", "l1l2", "f1f2"],
    note: "Original plus a copy. Required when you are the spouse on H-4, L-2, or F-2. A registered certificate is stronger than a religious-only document.",
  },
  {
    title: "Marriage certificate (if your spouse is traveling or listed)",
    need: "if-applies",
    marital: ["married"],
    kinds: ["consular"],
    visas: ["h1b", "b1b2"],
    note: "Bring it if your spouse is applying with you, is on your DS-160, or the officer needs to see the relationship.",
  },
  {
    title: "Wedding photos or invitation (a small set)",
    need: "usually",
    marital: ["married"],
    kinds: ["consular"],
    visas: ["h4", "l1l2", "f1f2"],
    note: "A few photos, not an album. Some posts in India have asked for these on dependent cases.",
  },
  {
    title: "Spouse’s passport bio pages",
    need: "usually",
    marital: ["married"],
    kinds: ["consular"],
    note: "Even if your spouse is not applying today. If they already have a U.S. visa, bring a copy of that visa page.",
  },
  {
    title: "Children’s birth certificates",
    need: "if-applies",
    marital: ["married"],
    kinds: ["consular"],
    note: "Original plus copy, for each child applying (H-4, L-2, or F-2) or listed on the DS-160.",
  },
  {
    title: "Divorce decree or spouse’s death certificate",
    need: "must",
    marital: ["divorced"],
    kinds: ["consular"],
    note: "Bring the court order or death certificate if your passport, DS-160, or petition uses a previous married name, or if you were previously married.",
  },
  {
    title: "No extra relationship papers",
    need: "usually",
    marital: ["single"],
    kinds: ["consular"],
    note: "If you have never been married, you do not need a marriage certificate. If a parent or sibling is sponsoring travel (common on B-2), bring their letter and proof they can support you.",
  },
];

export const POST_NOTES: Record<PostId, string> = {
  chennai:
    "Same document set as the other posts. Blanket L-1 interviews for India have long been handled here — if that is your case, confirm the city on the appointment letter.",
  hyderabad: "Same document set as the other posts. Follow the OFC and consular addresses printed on your confirmation.",
  kolkata: "Same document set as the other posts. Follow the OFC and consular addresses printed on your confirmation.",
  mumbai: "Same document set as the other posts. Follow the OFC and consular addresses printed on your confirmation.",
  "new-delhi":
    "Same document set as the other posts. The embassy is in New Delhi; the OFC address is on your confirmation, not at the embassy.",
};

export const OFFICIAL_LINKS = [
  { href: "https://travel.state.gov/content/travel/en/us-visas.html", label: "travel.state.gov — visa types" },
  { href: "https://in.usembassy.gov/visas/", label: "U.S. Mission India — visas" },
  { href: "https://www.usvisascheduling.com/en-US/", label: "usvisascheduling.com — appointments" },
  {
    href: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html",
    label: "Photo rules",
  },
];

export function matchesDoc(
  doc: DocItem,
  visa: VisaClassId,
  marital: MaritalStatus,
  kind: AppointmentKind | "both",
  post: PostId | "all",
): boolean {
  if (doc.visas && !doc.visas.includes(visa)) return false;
  if (doc.marital && !doc.marital.includes(marital)) return false;
  if (kind !== "both" && doc.kinds && !doc.kinds.includes(kind)) return false;
  if (post !== "all" && doc.posts && !doc.posts.includes(post)) return false;
  if (post === "all" && doc.posts) return false;
  return true;
}

export const DOCUMENTS = all;
