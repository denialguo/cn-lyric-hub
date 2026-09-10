import React from 'react';
import { Link } from 'react-router-dom';
import LegalLayout, { Section, Bullets } from '../components/LegalLayout';

const PrivacyPage = () => (
  <LegalLayout
    title="Privacy Policy"
    description="What data CN Lyric Hub collects, how it is stored, and how to have it deleted. No ads, no data sales, no advertising trackers."
    canonicalPath="/privacy"
    updated="9 September 2026"
    intro="CN Lyric Hub is a non-commercial community project run by one person. This page explains exactly what data the site collects, why, where it lives, and how to get it removed. There are no ads, no data sales, and no advertising trackers."
  >
    <Section heading="1. The short version">
      <Bullets
        items={[
          'You can read every song on this site without an account and without signing in.',
          'If you sign in, we store the profile details you choose plus the contributions you make.',
          'Everything you contribute — translations, comments, votes, likes — is public by design.',
          'We do not sell, rent, or share your data with advertisers. We run no advertising trackers.',
          'You can ask for your account and content to be deleted at any time, and we will do it.',
        ]}
      />
    </Section>

    <Section heading="2. What we collect">
      <p><strong>If you sign in with Google.</strong> Google sends us your name, email address, and profile picture URL. We use the email to identify your account and the name and picture to pre-fill your profile. We do not receive your Google password, contacts, or anything else from your Google account.</p>
      <p><strong>If you sign up with email and password.</strong> We store your email address and a username you choose. Your password is hashed and stored by our authentication provider — it is never visible to us.</p>
      <p><strong>If you never sign in.</strong> The first time you like, vote on, or comment on something, the site creates an anonymous account for you. It holds a random identifier and nothing else — no email, no name, no IP address. It exists so your like can be attributed to something and not forged by someone else.</p>
      <p><strong>Your profile.</strong> Username, display name, avatar image, and bio. All of these are optional, and all of them are publicly visible. Avatar images you upload are stored in a public bucket, meaning anyone who has the file's URL can view it.</p>
      <p><strong>Your contributions.</strong> Song submissions, line translations, comments, replies, votes, and likes, each stored with your user identifier and a timestamp. These are public.</p>
      <p><strong>Song submissions.</strong> When a song or edit is submitted for review, we may record the submitting IP address to help us deal with spam and vandalism. It is visible only to the site administrator and is not shown publicly.</p>
    </Section>

    <Section heading="3. What we do not collect">
      <Bullets
        items={[
          'We do not collect your name, address, or phone number.',
          'We take no payment details — the site is free and has nothing to buy.',
          'We run no advertising or cross-site tracking, and we do not build advertising profiles.',
          'We do not send marketing email. The only email you may receive is account-related, such as verifying your address or resetting your password.',
        ]}
      />
    </Section>

    <Section heading="4. Cookies and browser storage">
      <p>CN Lyric Hub sets no advertising or tracking cookies. We use your browser's local storage for two things:</p>
      <Bullets
        items={[
          'Your preferences — dark or light mode, accent colour, Simplified or Traditional script, lyric font sizes and colours, and any unsaved draft of a song you are adding. These never leave your browser.',
          'Your sign-in session, if you sign in. This is what keeps you logged in between visits, and clearing it signs you out.',
        ]}
      />
      <p>Because we use no non-essential cookies, the site does not show a cookie consent banner. Clearing your browser storage for this site removes all of the above.</p>
    </Section>

    <Section heading="5. Analytics">
      <p>We use Vercel Analytics and Vercel Speed Insights to see which pages are visited and how quickly they load. These are aggregated and cookieless: they record things like page path, referrer, country, and device type. They do not follow you across other websites and we cannot use them to identify you individually.</p>
    </Section>

    <Section heading="6. Other services your browser contacts">
      <p>Some content on this site is loaded directly from third parties, which means your browser contacts them and they can see your IP address and which page you are on:</p>
      <Bullets
        items={[
          <><strong>Apple</strong> — most album artwork is served from Apple's content delivery network rather than stored by us.</>,
          <><strong>YouTube</strong> — only on song pages that have a video. We use YouTube's privacy-enhanced embed domain, which avoids setting tracking cookies unless you actually start playing the video.</>,
          <><strong>Supabase</strong> — our database and authentication provider, which stores everything described in section 2.</>,
          <><strong>Vercel</strong> — our hosting provider, which serves the site and processes the analytics above.</>,
        ]}
      />
      <p>Each of these has its own privacy policy governing what it does with that information.</p>
    </Section>

    <Section heading="7. How long we keep things">
      <p>Your profile and contributions are kept for as long as your account exists, because they are part of a shared, collaborative database. Anonymous accounts that have never contributed anything may be cleared out periodically. If you ask us to delete your account, see the next section.</p>
    </Section>

    <Section heading="8. Your rights">
      <p>Whether or not you live somewhere with a law like the GDPR or UK GDPR, we will honour these requests:</p>
      <Bullets
        items={[
          <><strong>Access</strong> — ask for a copy of the data we hold about you.</>,
          <><strong>Correction</strong> — most of it you can edit yourself on your profile page; ask us for anything you cannot.</>,
          <><strong>Deletion</strong> — ask us to delete your account. We will remove your profile, avatar, email address, comments, and submissions. Where a translation of yours has been voted on or built upon by other people, we may keep the text and detach your name from it rather than delete it, so the shared work is not damaged. Tell us if you would rather it were deleted outright and we will do that instead.</>,
          <><strong>Objection and portability</strong> — ask and we will explain what applies and act on it.</>,
        ]}
      />
      <p>
        Email <a href="mailto:danieldenialdeveloping@gmail.com?subject=PRIVACY%20REQUEST">danieldenialdeveloping@gmail.com</a> with{' '}
        <span className="font-mono font-bold text-slate-200">PRIVACY REQUEST</span> in the subject. This is a personal project, not a company with a support desk, so allow a little time — but you will get a reply.
      </p>
    </Section>

    <Section heading="9. Children">
      <p>This site is not directed at children and we do not knowingly collect data from anyone under 13. If you believe a child has created an account, email us and we will remove it.</p>
    </Section>

    <Section heading="10. Lyrics and copyright">
      <p>
        Lyrics on this site are the property of their respective artists, songwriters, and publishers, and are provided for educational and personal study only. This is separate from your privacy, but if you are a rights holder wanting content removed, the process is in our{' '}
        <Link to="/faq">FAQ</Link>.
      </p>
    </Section>

    <Section heading="11. Changes">
      <p>If this policy changes in a way that affects what we collect or how we use it, we will update the date at the top of this page. Continuing to use the site after a change means you accept the updated policy.</p>
    </Section>
  </LegalLayout>
);

export default PrivacyPage;
