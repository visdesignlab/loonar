import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: JSX.Element;
  inputClass?: string
};

const FeatureListOne: FeatureItem[] = [
  {
    title: 'Flow Cytometry Analysis',
    Svg: require('@site/static/img/data-analysis.svg').default,
    description: (
      <>
        Examine how cells proliferate over time
      </>
    ),
  },
  {
    title: 'Time Series Cell Data Visualization',
    Svg: require('@site/static/img/page-analysis.svg').default,
    description: (
      <>
        Cross-check multiple data types:
        Line Charts, Tree Diagrams, & Images
      </>
    ),
  },
  {
    title: 'Cell Segmentation Debugging',
    Svg: require('@site/static/img/cell-drawing.svg').default,
    description:
      <>
        Quickly visually identify errors in segmentation tracking
      </>,
    inputClass: styles.smallSvg, 
  },
];

function Feature({ title, Svg, description, inputClass }: FeatureItem) {
  return (
    <div className={clsx('col col--4', inputClass)}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p >{description}</p>
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
            return <Feature key={idx} {...props} />
          }
          )}
        </div>
      </div>
    </section>
  );
}
