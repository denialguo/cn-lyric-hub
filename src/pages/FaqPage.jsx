import site from '../lib/site.json';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, HelpCircle, BookOpen, Scale } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { SITE_NAME, staticMeta } from '../lib/pageMeta';
import Navbar from '../components/Navbar';

const SECTIONS = [
  {
    title: 'Getting Started',
    subtitle: 'New to Chinese lyrics or the site? Start here.',
    icon: BookOpen,
    items: [
      {
        q: 'What is CN Lyrics?',
        a: "It's a place to read Chinese song lyrics with pinyin over every character and English translations alongside. You can flip between Simplified and Traditional, and add or vote on translations if you want to help out.",
      },
      {
        q: 'What are the small letters above each character?',
        a: 'That’s pinyin, the romanized pronunciation of each character. It sits right above the hanzi so you can sound out a line as you read it.',
      },
      {
        q: 'How do I switch between Simplified and Traditional characters?',
        a: 'Tap the script toggle (简体 / 繁體) in the top navigation, or open Appearance on a song page. The site remembers your choice, and the switch happens instantly in your browser.',
      },
      {
        q: 'How do the English translations work?',
        a: 'Each line can have a main translation plus alternates that other people have suggested. Open a line to see them all and pick whichever one reads best to you.',
      },
      {
        q: 'How does community translation voting work?',
        a: 'Click a line to open its panel, then upvote the translation you think is most accurate. The most upvoted ones move to the top, so the good ones rise over time. You can always add your own too.',
      },
      {
        q: 'How do I add a song?',
        a: 'Go to Add a Song, paste in the Chinese lyrics, and hit Auto-Fill to generate the pinyin. Songs from admins go live right away. Everyone else’s get a quick review first.',
      },
      {
        q: 'Can I fix or improve an existing song?',
        a: 'Yes. Open the song and choose Suggest Edit. Your changes go to review, and an admin can compare them with the original before approving.',
      },
      {
        q: 'Why do some songs have no English translation?',
        a: 'Translations come from people who add them, so newer or lesser-known songs may not have one yet. If you can help, open a line and add yours.',
      },
      {
        q: 'Do I need an account?',
        a: 'No. You can browse, read and search without one. An account just lets your contributions, translations and votes be saved to your profile.',
      },
      {
        q: 'Can I change how the lyrics look?',
        a: 'Yes. In Appearance you can resize the pinyin, characters and translations separately, recolor each one, pick a font, and switch between dark and light with your own accent color.',
      },
    ],
  },
  {
    title: 'Legal & Project',
    subtitle: 'Ownership, takedowns, and who’s behind the site.',
    icon: Scale,
    items: [
      {
        q: 'Who builds and maintains CN Lyrics?',
        a: 'It’s an independent, non-commercial project built and maintained by me! I’m a linguistics and computer science major at UCLA who wanted a really pretty place to read Chinese lyrics with English translations, instead of reading off some random blog and bouncing between different sites for the pinyin, the translation and the characters. Content is added by the community. There are no ads and nothing is sold.',
      },
      {
        q: 'Who owns the lyrics?',
        a: 'The lyrics belong to their artists, songwriters and publishers. CN Lyrics is a non-commercial project for education and personal study, and doesn’t claim ownership of any of the songs.',
      },
      {
        q: 'How do I request removal of copyrighted content? (DMCA)',
        a: (
          <>
            If you own the rights to a work and want it removed, email{' '}
            <a
              href="mailto:danieldenialdeveloping@gmail.com?subject=DMCA%20TAKEDOWN%20REQUEST"
              className="text-primary hover:underline"
            >
              danieldenialdeveloping@gmail.com
            </a>
            . Your subject line <span className="font-bold text-slate-200">must</span> start with{' '}
            <span className="font-mono font-bold text-slate-200">DMCA TAKEDOWN REQUEST</span>, or it may not get reviewed.
            Please include the song title and artist, a link to the page, and confirmation that you represent the
            rights holder so we can act on it quickly.
          </>
        ),
      },
    ],
  },
];

const FaqPage = () => {
  const [openKey, setOpenKey] = useState('0-0');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Helmet>
        <title>{staticMeta('faq').title}</title>
        <meta name="description" content={staticMeta('faq').description} />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={staticMeta('faq').title} />
        <meta property="og:description" content={staticMeta('faq').description} />
        <link rel="canonical" href={`${site.origin}/faq`} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: SECTIONS.flatMap(s => s.items.filter(i => typeof i.a === 'string').map(i => ({
            '@type': 'Question',
            name: i.q,
            acceptedAnswer: { '@type': 'Answer', text: i.a },
          }))),
        })}</script>
      </Helmet>
      <Navbar />

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-4 py-1.5 rounded-full text-sm font-bold mb-6">
            <HelpCircle size={16} /> Help Center
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4 text-white">Frequently Asked Questions</h1>
          <p className="text-slate-400">Everything you need to know about reading and contributing lyrics.</p>
        </div>

        <div className="space-y-12">
          {SECTIONS.map((section, s) => {
            const SectionIcon = section.icon;
            return (
              <div key={s}>
                <div className="mb-5 flex items-center gap-3">
                  <div className="bg-primary/10 text-primary p-2 rounded-lg">
                    <SectionIcon size={18} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{section.title}</h2>
                    <p className="text-xs text-slate-500">{section.subtitle}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {section.items.map((item, i) => {
                    const key = `${s}-${i}`;
                    const isOpen = openKey === key;
                    return (
                      <div key={key} className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                        <button
                          onClick={() => setOpenKey(isOpen ? '' : key)}
                          className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-slate-800/30 transition-colors"
                        >
                          <span className="font-bold text-white">{item.q}</span>
                          <ChevronDown
                            size={18}
                            className={`shrink-0 transition-transform ${isOpen ? 'rotate-180 text-primary' : 'text-slate-500'}`}
                          />
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-5 text-sm text-slate-400 leading-relaxed">
                            {item.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center text-sm text-slate-500">
          Still stuck? <Link to="/add" className="text-primary hover:underline">Contribute a song</Link> or reach out from the footer.
        </div>
      </div>
    </div>
  );
};

export default FaqPage;
