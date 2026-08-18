"use client";

export function DemoLogoutButton() {
  const handleLogout = () => {
    // A full document replacement clears in-memory photos and customer details
    // before the next demo user reaches the authentication screen.
    window.location.replace("/login");
  };

  return (
    <button onClick={handleLogout} type="button">
      로그아웃
    </button>
  );
}
