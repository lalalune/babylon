import { Footer, Layout, Navbar } from "nextra-theme-docs";
import "nextra-theme-docs/style.css";
import { getPageMap } from "nextra/page-map";
import type { ReactNode } from "react";
import Image from "next/image";

// import logo_full.svg directly, its next.js
import logo_full from "../logo_full.svg";

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
          logo={<Image src={logo_full} alt="Babylon Logo" width={160} height={38} />}
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

