import { SourcingTabs } from '@/features/sourcing/SourcingTabs';
import styles from '@/features/sourcing/Sourcing.module.css';

/** /platform/sourcing/*: the Buyer/Expert sourcing and escrow workspace. */
export default function SourcingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <SourcingTabs />
      {children}
    </div>
  );
}
