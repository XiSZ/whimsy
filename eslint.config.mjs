import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/**", "out/**", "xiszdev/**"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Fires on the SSR-safe "restore from localStorage in an effect"
      // pattern used throughout this app; aimed at React Compiler readiness,
      // which this project doesn't use.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // Vendored react-animated-counter code — ref-reads during render are its
    // measurement pattern; not worth restructuring.
    files: ["components/time/Ticker.tsx"],
    rules: { "react-hooks/refs": "off" },
  },
];

export default config;
