import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export interface OccurrenceTab {
  /**
   * Unique value for the tab.
   */
  value: string;
  /**
   * Label to display in the trigger.
   * This can include any JSX (for example, a count).
   */
  label: React.ReactNode;
  /**
   * Content to render when this tab is active.
   */
  content: React.ReactNode;
  /**
   * Optional custom classes for the trigger.
   */
  triggerClassName?: string;
  /**
   * Optional custom classes for the content.
   */
  contentClassName?: string;
}

export interface OccurrencesTabsProps {
  /**
   * The default selected tab value.
   */
  defaultValue: string;
  /**
   * Array of tab definitions.
   */
  tabs: OccurrenceTab[];
}

const OccurrencesTabs: React.FC<OccurrencesTabsProps> = ({ defaultValue, tabs }) => {
  return (
    <div className="w-full mt-4">
      <Tabs defaultValue={defaultValue} className="w-full">
        <TabsList className="flex justify-center">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={tab.triggerClassName}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className={tab.contentClassName || "border rounded-md p-4 mt-2"}
          >
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default OccurrencesTabs;
