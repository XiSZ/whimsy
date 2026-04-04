import clsx from "clsx";
import React from "react";

const Card = ({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={clsx(
        className,
        "flex flex-col rounded-xl shadow-lg overflow-hidden border",
        "border-[#2d2d2d]/70 bg-[#161616]/62 p-4 transition-[box-shadow] duration-300 hover:shadow-2xl backdrop-blur-lg backdrop-saturate-150",
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
