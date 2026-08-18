import Image from "next/image";
import Link from "next/link";
import styles from "./layout.module.css";

export type BottomNavItem =
  | "home"
  | "registration"
  | "progress"
  | "certificate";

type BottomNavProps = {
  active: BottomNavItem;
  certificateState?: "issued" | "locked";
};

const NAV_ITEMS: Array<{
  href: string;
  icon: string;
  id: BottomNavItem;
  label: string;
}> = [
  {
    href: "/home",
    icon: "/assets/mvp-beta/nav-home.svg",
    id: "home",
    label: "홈",
  },
  {
    href: "/products/new",
    icon: "/assets/mvp-beta/nav-orders.svg",
    id: "registration",
    label: "제품등록",
  },
  {
    href: "/orders/demo?stage=pickup",
    icon: "/assets/mvp-beta/icon-complete-check.svg",
    id: "progress",
    label: "진행조회",
  },
  {
    href: "/certificates/demo?state=locked",
    icon: "/assets/mvp-beta/icon-barcode.svg",
    id: "certificate",
    label: "보증서",
  },
];

export function BottomNav({
  active,
  certificateState = "locked",
}: BottomNavProps) {
  return (
    <nav aria-label="주요 메뉴" className={styles.bottomNav}>
      <div className={styles.bottomNavInner}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          const href =
            item.id === "certificate"
              ? `/certificates/demo?state=${certificateState}`
              : item.href;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={[
                styles.bottomNavLink,
                isActive ? styles.bottomNavLinkActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              href={href}
              key={item.id}
            >
              <span className={styles.bottomNavIcon}>
                <Image alt="" aria-hidden="true" fill src={item.icon} />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
