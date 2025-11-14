import { Footer, Layout, Navbar } from "nextra-theme-docs";
import "nextra-theme-docs/style.css";
import { getPageMap } from "nextra/page-map";
import type { ReactNode } from "react";

const footer = <Footer>MIT {new Date().getFullYear()} © Babylon.</Footer>;

export default async function DocsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Layout
      navbar={
        <Navbar
          logo={<span style={{ fontWeight: 700, fontSize: '1.25rem' }}>🏛️ Babylon Docs</span>}
          projectLink="https://github.com/elizaos/babylon"
        />
      }
      pageMap={await getPageMap()}
      docsRepositoryBase="https://github.com/elizaos/babylon/tree/main/docs"
      editLink="Edit this page on GitHub →"
      sidebar={{ 
        defaultMenuCollapseLevel: 1, 
        autoCollapse: true 
      }}
      copyPageButton={true}
      toc={{
        float: true,
        title: 'On This Page',
      }}
      footer={footer}
    >
      {children}
    </Layout>
  );
}

