import React from 'react';
import { Link } from 'react-router-dom';
import LegalLayout, { Section, Bullets } from '../components/LegalLayout';

const TermsPage = () => (
  <LegalLayout
    title="Terms of Service"
    description="The terms for using CN Lyric Hub: contributed translations and comments, acceptable use, content moderation, and the absence of any warranty."
    canonicalPath="/terms"
    updated="9 September 2026"
    intro="CN Lyric Hub is a free, non-commercial community project run by one person. By using the site you agree to what follows. It is written to be readable rather than impressive; if something here is unclear, ask."
  >
    <Section heading="1. Using the site">
      <p>You may browse, read, and study anything on this site without an account. If you create an account, you are responsible for what happens under it and for keeping your sign-in details to yourself. You must be at least 13 years old to create an account.</p>
    </Section>

    <Section heading="2. Content you contribute">
      <p><strong>You keep ownership of what you write.</strong> Translations, comments, song notes, and credits you contribute remain yours.</p>
      <p><strong>You give us permission to publish it.</strong> By submitting content you grant CN Lyric Hub a non-exclusive, worldwide, royalty-free licence to display, store, reproduce, and adapt it on the site, and to let other users read it and build on it. This licence exists so the site can function; it is not a transfer of ownership, and it does not let us sell your work.</p>
      <p><strong>Contributions are public and collaborative.</strong> Anything you post is visible to everyone. Other people may vote on your translations, reply to your comments, and submit improved versions. Expect your work to be edited, superseded, or discussed.</p>
      <p><strong>Only submit what you have the right to submit.</strong> Do not post translations copied from somewhere else, or content you do not have permission to share. Write your own.</p>
    </Section>

    <Section heading="3. Song lyrics and copyright">
      <p>Original song lyrics are the property of their respective artists, songwriters, and publishers. CN Lyric Hub claims no ownership of them. They are hosted here for educational and personal study — specifically to support learning Chinese through pronunciation guides and translation — and the site is non-commercial.</p>
      <p>
        If you own the rights to a work and want it removed, the takedown process and contact address are in our <Link to="/faq">FAQ</Link>. We act on valid requests.
      </p>
    </Section>

    <Section heading="4. Acceptable use">
      <p>Do not:</p>
      <Bullets
        items={[
          'Vandalise the catalogue — deleting or corrupting lyrics, titles, or translations that other people rely on.',
          'Post spam, advertising, malware, or links unrelated to the music.',
          'Harass, threaten, or abuse other contributors, or post hateful content.',
          'Submit deliberately wrong translations, or use the translation feature as a place to put jokes and abuse.',
          'Impersonate someone else, or claim credit for a translation you did not write.',
          'Manipulate votes or likes — including using multiple accounts to inflate your own contributions.',
          'Scrape or bulk-download the site, or hammer it with automated requests. Ask us if you want the data for something legitimate.',
          "Attempt to bypass access controls, probe for vulnerabilities without asking first, or interfere with anyone else's use of the site.",
        ]}
      />
      <p>If you find a security problem, please email us rather than exploiting it. We will be grateful, not annoyed.</p>
    </Section>

    <Section heading="5. Moderation">
      <p>We may remove, edit, reject, or hide any contribution, and suspend or delete any account, at our discretion and without notice. Song and edit submissions from non-administrators go into a review queue and may be published, changed, or declined. We are not obliged to explain a decision, though we generally will if you ask politely.</p>
      <p>We do not pre-screen everything that gets posted. If you see something that breaks these terms, email us.</p>
    </Section>

    <Section heading="6. Accuracy — please read this one">
      <p>Translations and pronunciation guides on this site are community-contributed and partly machine-generated. <strong>They contain mistakes.</strong> Pinyin is generated automatically and can pick the wrong reading for a character that has several. Translations may be loose, incomplete, or simply wrong.</p>
      <p>Do not rely on this site for anything that matters — exams, professional translation, legal or medical contexts, or tattoos. It is a study aid, not an authority.</p>
    </Section>

    <Section heading="7. No warranty">
      <p>The site is provided "as is" and "as available", without warranties of any kind, express or implied, including fitness for a particular purpose, accuracy, or uninterrupted availability. It is a personal project: it may go down, lose data, change substantially, or stop existing.</p>
    </Section>

    <Section heading="8. Limitation of liability">
      <p>To the fullest extent the law allows, CN Lyric Hub and its operator are not liable for any indirect, incidental, or consequential loss arising from your use of the site, including lost data or lost contributions. Nothing here limits liability that cannot legally be limited.</p>
    </Section>

    <Section heading="9. Ending it">
      <p>You may stop using the site at any time and ask us to delete your account — see the <Link to="/privacy">Privacy Policy</Link>. We may terminate access if you break these terms. Sections 2, 3, 7, and 8 survive termination.</p>
    </Section>

    <Section heading="10. Changes">
      <p>These terms may change. The date at the top of the page shows when they last did. Continuing to use the site after a change means you accept the new version.</p>
    </Section>

    <Section heading="11. Contact">
      <p>
        Email <a href="mailto:danieldenialdeveloping@gmail.com">danieldenialdeveloping@gmail.com</a> for anything to do with these terms, including takedown requests, account deletion, and security reports.
      </p>
    </Section>
  </LegalLayout>
);

export default TermsPage;
