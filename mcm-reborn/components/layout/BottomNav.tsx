import Image from "next/image";
import Link from "next/link";
import styles from "./layout.module.css";

export type BottomNavItem = "home" | "orders" | "profile";

type BottomNavProps = {
  active: BottomNavItem;
};

const NAV_ITEMS: Array<{
  href: string;
  icon: string;
  id: BottomNavItem;
  label: string;
}> = [
  {
    href: "/orders/demo",
    icon: "/assets/mvp-beta/nav-orders.svg",
    id: "orders",
    label: "신청내역",
  },
  {
    href: "/",
    icon: "/assets/mvp-beta/nav-home.svg",
    id: "home",
    label: "홈",
  },
  {
    href: "/mypage",
    icon: "/assets/mvp-beta/nav-profile.svg",
    id: "profile",
    label: "마이페이지",
  },
];

export function BottomNav({ active }: BottomNavProps) {
  return (
    <nav aria-label="주요 메뉴" className={styles.bottomNav}>
      <div className={styles.bottomNavInner}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={[
                styles.bottomNavLink,
                isActive ? styles.bottomNavLinkActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              href={item.href}
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
