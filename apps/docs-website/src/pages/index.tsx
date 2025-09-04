import clsx from "clsx";
import React from "react";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import styles from "./index.module.css";
import { demoURL } from "../constants/demoUrl";

/**
 * @returns Homepage component
 */
export default function Home(): JSX.Element {
  return (
    <Layout>
      {/** Homepage wrapper - height, width etc.*/}
      <div className={styles.pageWrapper}>
        <section className={clsx(styles.heroSection)}>
          {/** Background video */}
          <div className={styles.heroVideoWrapper}>
            <video
              className={styles.heroVideo}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            >
              <source src="./videos/loon_demo_video_1.mp4" type="video/mp4" />
              {/* Fallback text */}
              Your browser does not support the video tag.
            </video>
          </div>
          <div className={styles.heroContent}>
            {/** Header Text */}
            <header className={styles.heroHeader}>
              <h1 className={styles.headline}>
                <span className={styles.headlineLine}>Data Visualization</span>
                <span className={styles.headlineLine}>
                  <span className={styles.smallerFont}>for</span> Live Cell
                  Microscopy
                </span>
              </h1>
            </header>
            <div className={styles.buttonRow}>
              {/** Get Started Button */}
              <Link
                className="button button--primary button--lg"
                to="/docs/introduction"
              >
                Get Started{" "}
                <span className={styles.arrow} aria-hidden="true">
                  ↗
                </span>
              </Link>
              {/** Demo Button */}
              <Link className="button button--primary button--lg" to={demoURL}>
                Demo{" "}
                <span className={styles.arrow} aria-hidden="true">
                  ↗
                </span>
              </Link>
            </div>
          </div>
        </section>
        {/* Loon Description Section */}
        <section className={styles.descriptionSection}>
          <div className={styles.descriptionContent}>
            <p>
              <strong>Loon</strong> is a free, open-source{" "}
              <strong>visualization tool</strong> for live cell microscopy
              data.&nbsp;&nbsp;<strong>Analyze</strong> your cell data,{" "}
              <strong>identify</strong> data processing mistakes, and{" "}
              <strong>communicate</strong> your findings.
              <br />
              <Link
                href="https://vdl.sci.utah.edu/publications/2024_vis_aardvark/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span style={{ fontSize: "0.8em" }}>🏆</span>
                &nbsp;&nbsp;&nbsp;Best Paper Award: IEEE VIS 2024
              </Link>
              <span style={{ margin: "0 15px", color: "grey" }}>|</span>
              <Link
                href="https://loon.sci.utah.edu/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span style={{ fontSize: "0.8em" }}>🏆</span>
                &nbsp;&nbsp;&nbsp;Honorable Mention Award: IEEE VIS 2021
              </Link>
            </p>
          </div>
        </section>
        {/* VDL Logo Centered at Bottom */}
        <div className={styles.logoContainer}>
          <Link href="https://vdl.sci.utah.edu/" target="_blank" rel="noopener noreferrer">
            <img
              src="./img/vdl_logo_transparent.png"
              alt="VDL Logo"
              className={styles.logoImg}
            />
          </Link>
        </div>
      </div>
    </Layout>
  );
}
