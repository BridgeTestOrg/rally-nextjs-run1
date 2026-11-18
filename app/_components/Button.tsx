"use client";

import type {
  ComponentPropsWithoutRef,
  MouseEvent,
  MouseEventHandler,
  ReactNode,
} from "react";

export type ButtonVariant = "ball" | "ghost" | "court";

type SharedProps = {
  variant: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
};

type LinkProps = SharedProps &
  Omit<ComponentPropsWithoutRef<"a">, keyof SharedProps | "href"> & {
    href: string;
  };

type NativeButtonProps = SharedProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof SharedProps> & {
    href?: undefined;
  };

export type ButtonProps = LinkProps | NativeButtonProps;

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  ball: "rally-button--ball",
  ghost: "rally-button--ghost",
  court: "rally-button--court",
};

function classNames(variant: ButtonVariant, className: string | undefined) {
  return ["rally-button", VARIANT_CLASS[variant], className]
    .filter(Boolean)
    .join(" ");
}

function blockWhileLoading(
  loading: boolean,
  handler: MouseEventHandler<HTMLAnchorElement> | undefined,
) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }

    handler?.(event);
  };
}

function Label({
  loading,
  children,
}: {
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {loading ? (
        <span className="rally-button__spinner" aria-hidden="true" />
      ) : null}
      {children}
    </>
  );
}

export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const {
      variant,
      loading = false,
      children,
      className,
      onClick,
      onAuxClick,
      ...anchorProps
    } = props;

    return (
      <a
        {...anchorProps}
        className={classNames(variant, className)}
        aria-busy={loading ? true : anchorProps["aria-busy"]}
        aria-disabled={loading ? true : anchorProps["aria-disabled"]}
        onClick={blockWhileLoading(loading, onClick)}
        onAuxClick={blockWhileLoading(loading, onAuxClick)}
      >
        <Label loading={loading}>{children}</Label>
      </a>
    );
  }

  const {
    variant,
    loading = false,
    children,
    className,
    disabled,
    type = "button",
    ...buttonProps
  } = props;

  return (
    <button
      {...buttonProps}
      type={type}
      className={classNames(variant, className)}
      disabled={disabled || loading}
      aria-busy={loading ? true : buttonProps["aria-busy"]}
    >
      <Label loading={loading}>{children}</Label>
    </button>
  );
}
