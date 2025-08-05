import clsx from "clsx";
import React from "react";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import HomepageFeatures from "../components/HomepageFeatures";

import styles from "./index.module.css";
import ImageSwitcher from "../components/ImageSwitcher";
import Banner from "../components/Banner/Banner";

function HomepageHeader() {
  return (
    <header className={clsx("hero hero--secondary", styles.heroBanner)}>
      <div className="container">
        <div className={styles.titleContainer}>
          <ImageSwitcher
            lightImageSrc={"img/logos/loon-logo-bordered-light.svg"}
            darkImageSrc={"img/logos/loon-logo-bordered-dark.svg"}
            className={clsx(styles.largeItem, styles.homepageLogo)}
          />
          <ImageSwitcher
            lightImageSrc={"img/logos/loon-logo-bordered-light.svg"}
            darkImageSrc={"img/logos/loon-logo-bordered-dark.svg"}
            className={clsx(styles.smallItem, styles.homepageLogo)}
          />
          <div className={clsx("hero__title", styles.description)}>
            Live Cell Microscopy Data Visualization
          </div>
        </div>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/introduction"
          >
            Get Started
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
      <main>
        <div>
          Loon is a visualization analysis tool for live cell microscopy data.
          The techniques in the software are from multiple award winning
          publications. Loon: Using Exemplars to Visualize Large-Scale
          Microscopy Data and Aardvark: Composite Visualizations of Trees,
          Time-Series, and Images what are five cool things. live cell imaging
          with linked roi data, lineage view, exemplar view, two screenshots of
          the tools.
        </div>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
