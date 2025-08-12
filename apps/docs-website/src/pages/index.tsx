import clsx from "clsx";
import React from "react";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import HomepageFeatures from "../components/HomepageFeatures";

import styles from "./index.module.css";
import ImageSwitcher from "../components/ImageSwitcher";

function HomepageHeader() {
  return (
    <header className={clsx("hero hero--secondary", styles.heroBanner)}>
      <div className="container">
        <div className={styles.titleContainer}>
          <div className={clsx("hero__title", styles.headline)}>
            <span className={styles.headlineLine}>Live Cell Microscopy</span>
            <span className={styles.headlineLine}>Data Visualization</span>
          </div>
        </div>
        <div className={styles.buttonRow}>
          <Link
            className="button button--primary button--lg"
            to="/docs/introduction"
          >
            Get Started <span className={styles.arrow} aria-hidden="true">↗</span>
          </Link>
          <Link
            className="button button--primary button--lg"
            to="https://loonsw.sci.utah.edu/"
          >
            Demo <span className={styles.arrow} aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout>
      <HomepageHeader />
      <hr />
      <main>
        <div className="container">
          Loon is a visualization analysis tool for live cell microscopy data.
          The techniques in the software are from multiple award winning
          publications. Loon: Using Exemplars to Visualize Large-Scale
          Microscopy Data and Aardvark: Composite Visualizations of Trees,
          Time-Series, and Images what are five cool things. live cell imaging
          with linked roi data, lineage view, exemplar view, two screenshots of
          the tools.
        </div>
      </main>
    </Layout>
  );
}
