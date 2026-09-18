/// <reference types="nativewind/types" />

// NativeWind v4 augments react-native's ViewProps / TextProps with className
// via declaration merging. The re-export chain in react-native 0.76 doesn't
// always pick that up during type-checking, so we re-augment explicitly here.
declare module "react-native" {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface PressableProps {
    className?: string;
  }
  interface TextInputProps {
    className?: string;
    placeholderClassName?: string;
  }
  interface ImageProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
    contentContainerClassName?: string;
  }
  interface SwitchProps {
    className?: string;
  }
}

export {};
