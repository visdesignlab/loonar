import clsx from "clsx";
import React from "react";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import styles from "./index.module.css";
import { demoURL } from "./demoUrl";

/**
 * @returns Homepage component
 */
export default function Home(): JSX.Element {
  return (
    <Layout>
      <div className={styles.pageWrapper}>
        <section className={clsx(styles.heroSection)}>
          <div className={styles.heroVideoWrapper}>
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
          </div>
          <div className={styles.heroContent}>
            <header className={styles.heroHeader}>
              <h1 className={styles.headline}>
                <span className={styles.headlineLine}>Data Visualization</span>
                <span className={styles.headlineLine}>for Live Cell Microscopy</span>
              </h1>
            </header>
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
        </section>
      </div>
    </Layout>
  );
}