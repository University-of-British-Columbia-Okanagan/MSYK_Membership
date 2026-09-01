/**
 * lucide-react ships ES modules only, and jest does not transform node_modules. The icons
 * are decorative in every component under test, so this stands in a render-safe span for
 * any icon name rather than adding a babel pipeline for one dependency.
 */
const React = require("react");

const Icon = React.forwardRef(function Icon(props, ref) {
  return React.createElement("span", { ref, "aria-hidden": "true", ...props });
});

module.exports = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "__esModule") return true;
      return Icon;
    },
  }
);
