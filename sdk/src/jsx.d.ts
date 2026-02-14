/**
 * AOTUI JSX Type Extensions
 *
 * Extend Preact's JSX types to support AOTUI-specific attributes
 */
import "preact";

declare module "preact" {
  namespace JSX {
    interface HTMLAttributes<RefType extends EventTarget = EventTarget> {
      // AOTUI View attribute
      view?: string;

      // AOTUI List attributes
      list?: string;
      "item-type"?: string;

      // AOTUI Operation attribute
      operation?: string;

      // AOTUI ViewLink attribute
      "view-target"?: string;

      // AOTUI Description attribute (for Operation and ViewLink)
      desc?: string;

      // AOTUI Data attribute (already standard, but ensure it's here)
      "data-value"?: string;
      "data-empty"?: string;
    }

    interface ParamHTMLAttributes<RefType extends EventTarget = EventTarget> {
      type?: string;
      required?: string;
    }
  }
}
