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
    title: 'Thing 1',
    Svg: require('@site/static/img/page-analysis.svg').default,
    description: (
      <>
        Stuff about thing 1!
      </>
    ),
  },
  {
    title: 'Thing 2',
    Svg: require('@site/static/img/cloud-acceleration.svg').default,
    description: (
      <>
        Stuff about thing 2!
      </>
    ),
  },
  {
    title: 'Thing 3',
    Svg: require('@site/static/img/data-analysis.svg').default,
    description: (
      <>
        Stuff about thing 3!
      </>
    ),
  },
  {
    title: 'Thing 4',
    Svg: require('@site/static/img/mobile-app.svg').default,
    description: (
      <>
        Stuff about thing 4!
      </>
    ),
    inputClass: 'col--offset-2'
  },
  {
    title: 'Thing 5',
    Svg: require('@site/static/img/dns.svg').default,
    description: (
      <>
        Stuff about thing 5!
      </>
    ),
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
