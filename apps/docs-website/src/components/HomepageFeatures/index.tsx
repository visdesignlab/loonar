import clsx from "clsx";
import Heading from "@theme/Heading";
import styles from "./styles.module.css";

type FeatureItem = {
  title: string;
  // Svg?: React.ComponentType<React.ComponentProps<"svg">>;
  Png?: string;
  description: JSX.Element;
  inputClass?: string;
};

const FeatureListOne: FeatureItem[] = [
  {
    title: "Exemplar View",
    // Svg: require("@site/static/img/page-analysis.svg").default,
    Png: require("@site/static/img/feature_exemplar.png").default,
    description: <>Stuff about thing 1!</>,
  },
  {
    title: "Lineage View",
    Png: require("@site/static/img/feature_lineage.png").default,
    description: <>Stuff about thing 2!</>,
  },
  {
    title: "Image View with Linked ROI Data",
    Png: require("@site/static/img/feature_image.png").default,
    description: <>Stuff about thing 3!</>,
  },
  {
    title: "Condition Comparison",
    Png: require("@site/static/img/feature_condition.png").default,
    description: <>Stuff about thing 4!</>,
    inputClass: "col--offset-2",
  },
  {
    title: "Filtering",
    Png: require("@site/static/img/feature_filter.png").default,
    description: <>Stuff about thing 5!</>,
  },
];

function Feature({ title, Png, description, inputClass }: FeatureItem) {
  return (
    <div className={clsx("col col--4", inputClass)}>
      {/* <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div> */}
      {Png && (
        <div className="text--center">
          <img src={Png} alt={title} className={styles.featureImg} />
        </div>
      )}
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureListOne.map((props, idx) => {
            return <Feature key={idx} {...props} />;
          })}
        </div>
      </div>
    </section>
  );
}
