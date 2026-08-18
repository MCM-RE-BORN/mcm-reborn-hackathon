import Image from "next/image";
import type { ButtonLinkProps } from "./Button";
import { ButtonLink } from "./Button";
import styles from "./ui.module.css";

type ActionButtonLinkProps = Omit<ButtonLinkProps, "children"> & {
  children: string;
};

export function ActionButtonLink({
  children,
  className,
  ...props
}: ActionButtonLinkProps) {
  return (
    <ButtonLink
      className={[styles.actionButtonLink, className].filter(Boolean).join(" ")}
      {...props}
    >
      <span>{children}</span>
      <Image
        alt=""
        aria-hidden="true"
        height={12}
        src="/assets/mvp-beta/figma-chevron-right.svg"
        width={15}
      />
    </ButtonLink>
  );
}
