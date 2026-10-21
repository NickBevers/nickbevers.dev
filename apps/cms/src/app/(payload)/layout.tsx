import config from '@payload-config';
import '@payloadcms/next/css';
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts';
import { Fira_Code, Hanken_Grotesk } from 'next/font/google';
import type { ServerFunctionClient } from 'payload';
import type { ReactNode } from 'react';

import { importMap } from './admin/importMap';
import './custom.css';

// next/font downloads these at build time and serves them from the CMS itself, like the site
// does, so no request goes to Google. The variable names match the site's, so tokens.css works.
const hanken = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-hanken', display: 'swap' });
const fira = Fira_Code({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

const serverFunction: ServerFunctionClient = async (args) => {
  'use server';
  return handleServerFunctions({ ...args, config, importMap });
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootLayout
      config={config}
      importMap={importMap}
      serverFunction={serverFunction}
      htmlProps={{ className: `${hanken.variable} ${fira.variable}` }}
    >
      {children}
    </RootLayout>
  );
}
