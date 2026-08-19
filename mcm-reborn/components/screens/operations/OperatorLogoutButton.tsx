"use client";

import { useRouter } from "next/navigation";
import { clearOperatorSession } from "./operator-client";
import styles from "./operations.module.css";

export function OperatorLogoutButton() {
  const router = useRouter();

  function handleLogout() {
    clearOperatorSession();
    router.replace("/operations");
    router.refresh();
  }

  return (
    <button
      className={styles.logoutButton}
      onClick={handleLogout}
      type="button"
    >
      로그아웃
    </button>
  );
}
