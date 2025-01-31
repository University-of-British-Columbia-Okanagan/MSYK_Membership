import { ReactNode } from "react";

interface GridSectionProps {
  leftContent: ReactNode;
  rightContent: ReactNode;
  leftBg?: string;
  rightBg?: string;
}

const GridSection = ({
  leftContent,
  rightContent,
  leftBg = "bg-indigo-500",
  rightBg = "bg-gray-800",
}: GridSectionProps) => {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2">
      {/* Left Section */}
      <div className={`${leftBg} p-8 flex items-center justify-center text-white`}>
        {leftContent}
      </div>

      {/* Right Section */}
      <div className={`${rightBg} p-8 flex items-center justify-center text-white`}>
        {rightContent}
      </div>
    </section>
  );
};

export default GridSection;
