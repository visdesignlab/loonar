import clsx from "clsx";
import React from "react";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";

import styles from "./index.module.css";
import { demoURL } from "./demoUrl";

function HomepageHeader() {
  return (
    <header className={clsx("hero hero--secondary", styles.heroBanner)}>
      <video
        className={styles.heroVideo}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source src="/videos/loon_demo_video_1.mp4" type="video/mp4" />
        {/* Fallback text */}
        Your browser does not support the video tag.
      </video>
      <div className={styles.heroContent}>
        <div className={styles.titleContainer}>
          <div className={clsx("hero__title", styles.headline)}>
            <span className={styles.headlineLine}>Data Visualization</span>
            <span className={styles.headlineLine}>for Live Cell Microscopy</span>
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
            to={demoURL}
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
      <div className={styles.pageWrapper}>
        <HomepageHeader />
      </div>
    </Layout>
  );
}
