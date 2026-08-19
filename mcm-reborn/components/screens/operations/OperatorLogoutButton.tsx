"use client";

import { useEffect, useState } from "react";
import {
  clearOperatorSession,
  hasOperatorSession,
  onOperatorSessionChange,
} from "./operator-client";
import styles from "./operations.module.css";

export function OperatorLogoutButton() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const sync = () => setIsAuthenticated(hasOperatorSession());
    sync();
    return onOperatorSessionChange(sync);
  }, []);

  function handleLogout() {
    clearOperatorSession();
    // A document replacement also clears in-memory operator detail state.
    window.location.replace("/operations");
  }

  if (!isAuthenticated) {
    return null;
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
