# Search reindex checklist

Use this after a landing release changes what the marketing site says, when search engines (and the
AI tools that read their indexes) still show the old text.

Written 2026-11-25. On that day an outside AI reviewer was served a three-month-old copy of
`/changelog` that still carried text removed in the Oct 26 rebuild. The live page was already
correct; the index was stale.

**Who does this:** Ibrahim, signed in to his own Google and Microsoft accounts. Nobody else has
access to the Search Console or Bing Webmaster Tools properties, and no account is created by this
checklist.

**Pages to recrawl this time**

- `https://mycargolens.com/changelog`
- `https://mycargolens.com/pricing`
- `https://mycargolens.com/platform`
- `https://mycargolens.com/compare`

## 0. Before you start (no sign-in needed)

Recrawling a page that hasn't changed yet wastes the request. The landing site deploys only from
`main`, so wait for the release that carries the change.

- [ ] The release is merged to `main` and the "Deploy prod landing" job is green.
- [ ] The live page shows the new text. For the changelog, the first entry should be
      "Rejected changes keep the accepted version on screen".
- [ ] The live sitemap carries the new dates:

```bash
curl -s https://mycargolens.com/sitemap.xml | grep -A1 -E "/(changelog|pricing|platform|compare)<"
```

`/changelog` should show the date of its newest entry, not `2026-10-26`.

## 1. Google Search Console

Sign in at <https://search.google.com/search-console> and pick the `mycargolens.com` property.

**1a. Resubmit the sitemap**

- [ ] Open **Sitemaps**. If `sitemap.xml` is listed, open it and check "Last read" is after the
      release. If it is older, or the sitemap isn't listed, enter
      `https://mycargolens.com/sitemap.xml` under "Add a new sitemap" and submit.

Google reads `<lastmod>` only while it stays accurate, and ignores `<priority>` and `<changefreq>`.
The old sitemap "ping" URL no longer exists, so this report is the only way to submit.

**1b. Ask for each page to be recrawled**

For each of the four URLs above:

- [ ] Paste the full URL in the inspection bar at the top of the page.
- [ ] Click **Test live URL** and confirm the tested page shows the new text (open "View tested
      page" and search the HTML for a new changelog title).
- [ ] Click **Request indexing**.

Notes:

- Google has a daily quota for these requests and doesn't publish the number. Four URLs is well
  inside it.
- Requesting the same URL again does not speed it up. Google says a recrawl takes from a few days
  to a few weeks.

**1c. Only if an old snippet is still showing after a week**

If a Google result for one of these pages still shows removed text (for example "certification
pending"):

- [ ] Open **Removals**, tab **Temporary Removals**, click **New Request**.
- [ ] Choose **Clear snippet in search**, paste the exact URL, click **Next** and confirm.

This keeps the page in results and blanks its description until Google indexes the page again. Do
not choose "Temporarily remove URL": that hides the page from Google for about six months.

Google's public "Refresh Outdated Content" tool is for pages you don't own. Don't use it here.

## 2. Bing Webmaster Tools

Bing matters more than its search share suggests: several AI assistants and smaller search engines
answer from Bing's index.

Sign in at <https://www.bing.com/webmasters> and pick `mycargolens.com`. If the site isn't there
yet, Bing offers to import it from Google Search Console, which avoids a second verification step.
Adding the site is your call; this checklist doesn't require it.

Bing's help pages would not load when this was written, so the menu names below are from memory and
may differ slightly.

- [ ] **Sitemaps**: check `https://mycargolens.com/sitemap.xml` is listed and was read after the
      release. If not, submit or resubmit it.
- [ ] **URL Submission**: click **Submit URLs**, paste the four URLs one per line, and submit. The
      page shows your remaining daily quota.
- [ ] **URL Inspection** (optional check a few days later): inspect `/changelog` and confirm the
      indexed copy is the new one.

## 3. Check back

- [ ] One week later: in Search Console, inspect each URL and read "Last crawl" under Page
      indexing. It should be after the release date.
- [ ] Search Google and Bing for `site:mycargolens.com changelog` and read the snippet.
- [ ] If an AI tool still quotes the old text, ask it for the date of its copy. A copy older than
      the "Last crawl" date is that provider's cache and can't be pushed from our side. The site's
      `robots.txt` already allows their crawlers.

## 4. Keeping this from happening again

- When a PR changes a page's copy, set that page's date in `ROUTE_UPDATED` in
  `landing/app/sitemap.ts`. `/changelog` takes its date from the newest entry in
  `landing/lib/changelog.ts`.
- Add a changelog entry in the same release as the change it describes. From Aug 6 to Nov 25 2026
  the page had no new entry while the product shipped three releases.

## Should we add IndexNow?

**Recommendation: yes, as a small follow-up. It does not replace the steps above.**

IndexNow is a push protocol: the site tells participating engines which URLs changed, and they
fetch them soon after. Bing, Yandex, Naver, Seznam and Yep take part. Google does not, so section 1
stays manual either way.

Why it's worth it for us:

- The stale copy that started this came from an index, not from Google's results page, and the
  Bing index is the one IndexNow reaches.
- The landing shipped five times between Oct 26 and Nov 25. Remembering section 2 after every
  release won't last.
- It is small: a key file in `landing/public/` (`<key>.txt` containing the key) and one step at the
  end of the "Deploy prod landing" job that POSTs the changed URLs to
  `https://api.indexnow.org/indexnow`. No account and no secret are needed, because the key is
  public by design.

What to watch:

- Submit only URLs whose content changed. The protocol asks for that, and the per-route dates in
  `sitemap.ts` give the list (routes whose date is the release day).
- It is a hint, the same as a sitemap. It makes Bing's copy fresher but can't force any AI
  provider's own cache to update.

Not done in the PR that added this file. It changes the deploy pipeline, so it should be its own PR.
