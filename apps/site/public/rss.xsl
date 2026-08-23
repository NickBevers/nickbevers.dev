<?xml version="1.0" encoding="utf-8"?>
<!-- A feed opened in a browser is usually a wall of XML. This renders it as a
     readable page while staying a valid feed for readers. -->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title><xsl:value-of select="/rss/channel/title"/></title>
        <style>
          :root { color-scheme: light dark; }
          body {
            margin: 0 auto; padding: 48px 24px; max-width: 680px;
            font: 16px/1.6 system-ui, sans-serif;
            background: #f7f5f2; color: #1a1a1a;
          }
          @media (prefers-color-scheme: dark) {
            body { background: #10221b; color: #f1f4f3; }
            .note { background: #2d3935; border-color: #8ca69d; }
            a { color: #c6d2ce; }
          }
          h1 { font-size: 32px; letter-spacing: -0.03em; margin: 0 0 8px; }
          .note {
            padding: 14px 16px; margin: 24px 0 40px;
            border: 1px solid #1a1a1a; background: #ece7df; font-size: 14px;
          }
          li { list-style: none; padding: 18px 0; border-bottom: 1px solid rgba(128,128,128,.35); }
          ul { padding: 0; margin: 0; }
          .d { font-size: 12px; text-transform: uppercase; letter-spacing: .14em; opacity: .7; }
          a { color: #435650; font-weight: 700; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1><xsl:value-of select="/rss/channel/title"/></h1>
        <p><xsl:value-of select="/rss/channel/description"/></p>
        <p class="note">
          This is an RSS feed. Paste this page's address into a feed reader to
          subscribe, and new entries will arrive without an email address changing hands.
        </p>
        <ul>
          <xsl:for-each select="/rss/channel/item">
            <li>
              <div class="d"><xsl:value-of select="pubDate"/></div>
              <a href="{link}"><xsl:value-of select="title"/></a>
              <p><xsl:value-of select="description"/></p>
            </li>
          </xsl:for-each>
        </ul>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
