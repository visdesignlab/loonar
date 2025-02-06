import clsx from 'clsx';
import styles from './styles.module.css';


export default function Banner(): JSX.Element {
  return (
    <section className={styles.banner}>
      <div className="container">
        <div className={styles.bannerColumn}>
          <div className={styles.bannerTitle}>ReVISit Version 1.0.0 Is Out! &#127881;</div>
          <div className={styles.bannerSubtitle}>
            <a target="_blank" href="https://vdl.sci.utah.edu/blog/2024/06/20/revisit/">Read the blog post.</a>
          </div>
        </div>
      </div>
    </section>
  );
}
