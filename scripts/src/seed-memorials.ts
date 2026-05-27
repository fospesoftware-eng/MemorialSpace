/**
 * Seeds demo memorial data with real images for the family portal.
 * Updates existing burials with proper portraits, memorials with rich content,
 * and adds demo tributes. Idempotent — safe to re-run.
 *
 * Run with: pnpm --filter @workspace/scripts run seed-memorials
 */
import { db, burialsTable, memorialsTable, tributesTable, organizationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const BASE_IMAGE = "/images/memorials";

const BURIAL_UPDATES = [
  {
    id: 1,
    deceasedName: "Eleanor Rose Thompson",
    deceasedDob: "1934-03-15",
    deceasedDod: "2021-11-22",
    burialDate: "2021-11-28",
    religion: "Christian",
    photoUrl: `${BASE_IMAGE}/portrait-eleanor.png`,
    notes: "Beloved mother, grandmother, and friend. Eleanor spent 40 years teaching kindergarten and touched the lives of hundreds of children. She loved gardening, classical music, and Sunday family dinners.",
  },
  {
    id: 2,
    deceasedName: "George William Mitchell",
    deceasedDob: "1941-07-04",
    deceasedDod: "2022-09-14",
    burialDate: "2022-09-20",
    religion: "Christian",
    photoUrl: `${BASE_IMAGE}/portrait-george.png`,
    notes: "Veteran, firefighter, and community volunteer for 35 years. George was known for his infectious laugh and his willingness to help anyone in need. He loved fishing, classic cars, and telling stories.",
  },
  {
    id: 3,
    deceasedName: "Robert James Anderson",
    deceasedDob: "1928-01-12",
    deceasedDod: "2024-02-08",
    burialDate: "2024-02-15",
    religion: "Jewish",
    photoUrl: `${BASE_IMAGE}/portrait-robert.png`,
    notes: "Professor of history for 45 years at the state university. Robert published 12 books on American civil rights history. He was a devoted husband, father of three, and grandfather of seven.",
  },
  {
    id: 4,
    deceasedName: "Patricia Mae Ng",
    deceasedDob: "1962-05-20",
    deceasedDod: "2025-01-10",
    burialDate: "2025-01-18",
    religion: "Buddhist",
    photoUrl: `${BASE_IMAGE}/portrait-patricia.png`,
    notes: "Artist, teacher, and community organizer. Patricia's watercolor paintings have been exhibited in galleries across the Pacific Northwest. She founded the local youth arts program that serves 200 children annually.",
  },
  {
    id: 5,
    deceasedName: "Frank Anthony Deluca",
    deceasedDob: "1955-11-03",
    deceasedDod: "2023-06-18",
    burialDate: "2023-06-24",
    religion: "Catholic",
    photoUrl: null,
    notes: "Master carpenter and small business owner. Frank built homes for over 200 families in the region. He was passionate about mentorship and trained dozens of apprentices over his 40-year career.",
  },
  {
    id: 6,
    deceasedName: "Helen Marie Rosenberg",
    deceasedDob: "1948-09-28",
    deceasedDod: "2024-12-01",
    burialDate: "2024-12-07",
    religion: "Jewish",
    photoUrl: null,
    notes: "Librarian, poet, and lifelong learner. Helen curated the special collections at the city library for 30 years. She published three volumes of poetry and ran a weekly writers' workshop.",
  },
];

const MEMORIAL_UPDATES = [
  {
    id: 1,
    title: "Eleanor Rose Thompson — A Life of Love & Learning",
    biography: "Eleanor Rose Thompson was born on March 15, 1934, in Portland, Oregon. She devoted her life to education, spending 40 joyful years as a kindergarten teacher at Lincoln Elementary School. Her classroom was a place of wonder — filled with finger paintings, story time, and the gentle patience that only she could provide.\n\nBeyond teaching, Eleanor was an avid gardener. Her rose garden was the envy of the neighborhood, and she spent every spring weekend nurturing her blooms. She loved classical music, attending the symphony every month with her late husband, Thomas.\n\nEleanor's greatest pride was her family. She is survived by her two children, Margaret and David, five grandchildren, and two great-grandchildren. Sunday dinners at her home were a sacred tradition — no one missed them.\n\nShe passed peacefully on November 22, 2021, surrounded by her family. Her legacy lives on in every child she taught to read, every rose she planted, and every heart she touched.",
    photos: JSON.stringify([
      `${BASE_IMAGE}/portrait-eleanor.png`,
      `${BASE_IMAGE}/scene-flowers.png`,
      `${BASE_IMAGE}/scene-family.png`,
    ]),
    videos: null,
    isPublic: true,
    visibility: "open" as const,
    viewCount: 147,
  },
  {
    id: 2,
    title: "George William Mitchell — Bravery & Brotherhood",
    biography: "George William Mitchell was born on July 4, 1941, in Seattle, Washington — a true patriot from day one. He served his country in the Vietnam War and returned home to serve his community as a firefighter for 35 years. George ran into burning buildings when others ran out, and he saved countless lives without ever seeking recognition.\n\nAfter retiring from the fire department, George became a full-time volunteer — coaching Little League, building wheelchair ramps for neighbors, and organizing the annual Fourth of July parade. His laugh was loud, his heart was larger, and his stories were legendary.\n\nGeorge is survived by his wife of 48 years, Linda, their three children, and seven grandchildren. He loved fishing at Lake Washington, restoring classic cars, and gathering friends around his backyard grill.\n\nHe passed on September 14, 2022, after a courageous battle with cancer. His courage, kindness, and unwavering spirit will never be forgotten.",
    photos: JSON.stringify([
      `${BASE_IMAGE}/portrait-george.png`,
      `${BASE_IMAGE}/scene-candles.png`,
    ]),
    videos: null,
    isPublic: true,
    visibility: "open" as const,
    viewCount: 89,
  },
  {
    id: 3,
    title: "Robert James Anderson — Scholar, Mentor, Friend",
    biography: "Robert James Anderson was born on January 12, 1928, in Boston, Massachusetts. A passionate scholar from youth, he earned his PhD in American History and spent 45 years as a professor at the University of Washington. Robert authored 12 books on civil rights history, and his lectures inspired generations of students to pursue justice and truth.\n\nRobert believed that history was not just to be studied, but to be lived. He marched in Selma, organized voter registration drives, and served on the city civil rights commission for two decades. His office door was always open, and generations of students came to him for guidance, coffee, and wisdom.\n\nHe is survived by his wife of 55 years, Ruth, three children, and seven grandchildren. Robert loved jazz music, crossword puzzles, and long walks through the university district.\n\nHe passed peacefully on February 8, 2024, at the age of 96, leaving behind a lifetime of scholarship, activism, and love.",
    photos: JSON.stringify([
      `${BASE_IMAGE}/portrait-robert.png`,
      `${BASE_IMAGE}/scene-cemetery.png`,
    ]),
    videos: null,
    isPublic: true,
    visibility: "open" as const,
    viewCount: 212,
  },
  {
    id: 4,
    title: "Patricia Mae Ng — Colors of a Beautiful Life",
    biography: "Patricia Mae Ng was born on May 20, 1962, in San Francisco, California. A gifted artist from childhood, she earned her MFA in Fine Arts and became one of the Pacific Northwest's most beloved watercolor painters. Her work captured the misty mountains, the wild coastlines, and the quiet beauty of everyday life.\n\nPatricia was also a dedicated teacher. In 1995, she founded the Greenwood Youth Arts Program, which has provided free art education to over 200 children annually for nearly three decades. She believed every child deserved access to creativity, regardless of their circumstances.\n\nHer paintings have been exhibited in galleries from Seattle to Portland, and three of her pieces are in the permanent collection of the city's art museum. Patricia loved hiking, meditation, and hosting dinner parties for her large circle of friends.\n\nShe passed on January 10, 2025, after a brief illness. Her vibrant spirit lives on in every canvas she painted, every child she inspired, and every life she touched with her generosity and joy.",
    photos: JSON.stringify([
      `${BASE_IMAGE}/portrait-patricia.png`,
      `${BASE_IMAGE}/scene-flowers.png`,
      `${BASE_IMAGE}/scene-candles.png`,
      `${BASE_IMAGE}/scene-family.png`,
    ]),
    videos: null,
    isPublic: true,
    visibility: "open" as const,
    viewCount: 334,
  },
];

const DEMO_TRIBUTES = [
  { memorialId: 1, authorName: "Margaret Thompson", authorEmail: "margaret.t@email.com", message: "Mom, you taught me that kindness is the greatest strength. I still make your apple pie recipe every Thanksgiving. Your roses are blooming beautifully this year." },
  { memorialId: 1, authorName: "James Mitchell", authorEmail: "james.m@email.com", message: "Aunt Eleanor, I still remember reading 'Goodnight Moon' in your lap. You made every child feel special. The world was better with you in it." },
  { memorialId: 1, authorName: "Sarah Chen", authorEmail: "sarah.chen@email.com", message: "Thank you for being such a wonderful neighbor and friend. Your garden was a gift to our entire street. We miss your smile every day." },
  { memorialId: 1, authorName: "David Thompson", authorEmail: "david.t@email.com", message: "Mom, I finally finished the bookshelf you asked me to build. It's in the living room, right where you wanted it. I'll keep the Sunday dinner tradition alive." },
  { memorialId: 1, authorName: "Linda Garcia", authorEmail: "linda.g@email.com", message: "Mrs. Thompson was my kindergarten teacher 35 years ago, and I still remember her gentle voice and patience. She gave me my love of reading." },
  { memorialId: 2, authorName: "Linda Mitchell", authorEmail: "linda.m@email.com", message: "George, my love for 48 years. You were my hero from the day we met. The house is quieter without your laugh, but your spirit fills every room." },
  { memorialId: 2, authorName: "Michael Mitchell", authorEmail: "mike.m@email.com", message: "Dad, you taught me what it means to be a man of honor. I'll keep the classic car running and tell your stories to my kids." },
  { memorialId: 2, authorName: "Fire Station 42 Crew", authorEmail: "fs42@email.com", message: "Chief Mitchell was the heart of our station. He led with courage and compassion. We still hang his helmet by the door. Rest easy, brother." },
  { memorialId: 2, authorName: "Sarah Chen", authorEmail: "sarah.chen@email.com", message: "George helped build the ramp for my mother when she needed a wheelchair. He refused payment and said 'that's what neighbors do.' A true hero." },
  { memorialId: 3, authorName: "Ruth Anderson", authorEmail: "ruth.a@email.com", message: "Robert, my dearest. 55 years was not enough, but it was a beautiful journey. I'll keep your books on the shelf and your memory in my heart." },
  { memorialId: 3, authorName: "Dr. Samuel Park", authorEmail: "sam.park@email.com", message: "Professor Anderson changed the course of my life. His civil rights seminar opened my eyes and set me on the path to public service. Thank you, mentor." },
  { memorialId: 3, authorName: "Rebecca Torres", authorEmail: "becca.t@email.com", message: "Dr. Anderson's books sit on my shelf, and his words echo in my classroom. He showed us that history is alive, and we all have a part to play." },
  { memorialId: 3, authorName: "Sarah Chen", authorEmail: "sarah.chen@email.com", message: "I had the privilege of hearing Dr. Anderson speak at the library last year. At 95, he was still fighting for justice with a fire that inspired us all." },
  { memorialId: 4, authorName: "Thomas Ng", authorEmail: "tom.ng@email.com", message: "Patricia, my beautiful wife. Your colors lit up every room you entered. The studio is quiet now, but your paintings still sing with life." },
  { memorialId: 4, authorName: "Maya Johnson", authorEmail: "maya.j@email.com", message: "Ms. Ng was my art teacher when I was 12. She saw something in me that no one else did. Today I'm a professional artist because of her belief in me." },
  { memorialId: 4, authorName: "Greenwood Youth Arts", authorEmail: "gyap@email.com", message: "Our founder, our inspiration, our heart. Patricia built this program from nothing and touched hundreds of young lives. We will carry her vision forward." },
  { memorialId: 4, authorName: "Sarah Chen", authorEmail: "sarah.chen@email.com", message: "I purchased one of Patricia's watercolors at a gallery show last year. It hangs in my living room — a daily reminder of beauty and resilience." },
  { memorialId: 4, authorName: "David Chen", authorEmail: "david.c@email.com", message: "Patricia's dinner parties were legendary. Great food, better conversation, and the kind of warmth that made everyone feel at home. We miss you, friend." },
];

async function main() {
  console.log("[seed-memorials] starting");

  // 1) Update burials with rich data and images
  for (const b of BURIAL_UPDATES) {
    const [existing] = await db.select().from(burialsTable).where(eq(burialsTable.id, b.id)).limit(1);
    if (existing) {
      await db.update(burialsTable).set({
        deceasedName: b.deceasedName,
        deceasedDob: b.deceasedDob,
        deceasedDod: b.deceasedDod,
        burialDate: b.burialDate,
        religion: b.religion,
        photoUrl: b.photoUrl,
        notes: b.notes,
      }).where(eq(burialsTable.id, b.id));
      console.log(`[seed-memorials] updated burial ${b.id}: ${b.deceasedName}`);
    }
  }

  // 2) Update memorials with rich content
  for (const m of MEMORIAL_UPDATES) {
    const [existing] = await db.select().from(memorialsTable).where(eq(memorialsTable.id, m.id)).limit(1);
    if (existing) {
      await db.update(memorialsTable).set({
        title: m.title,
        biography: m.biography,
        photos: m.photos,
        videos: m.videos,
        isPublic: m.isPublic,
        visibility: m.visibility,
        viewCount: m.viewCount,
      }).where(eq(memorialsTable.id, m.id));
      console.log(`[seed-memorials] updated memorial ${m.id}: ${m.title}`);
    }
  }

  // 3) Seed tributes (clear old ones first for idempotency)
  const org = await db.select().from(organizationsTable).orderBy(organizationsTable.id).limit(1);
  const orgId = org[0]?.id ?? 1;

  // Seed tributes idempotently — only insert if the exact (memorialId, authorEmail) pair is missing.
  const existingTributes = await db.select().from(tributesTable);
  const key = (t: typeof existingTributes[0]) => `${t.memorialId}:${t.authorEmail}`;
  const existingKeys = new Set(existingTributes.map(key));
  let inserted = 0;
  for (const t of DEMO_TRIBUTES) {
    const k = `${t.memorialId}:${t.authorEmail}`;
    if (!existingKeys.has(k)) {
      await db.insert(tributesTable).values(t);
      existingKeys.add(k);
      inserted++;
    }
  }
  console.log(`[seed-memorials] seeded ${inserted} new tributes (skipped ${DEMO_TRIBUTES.length - inserted} duplicates)`);

  console.log("[seed-memorials] done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed-memorials] failed:", err);
    process.exit(1);
  });
