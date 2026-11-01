export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export interface MenuPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}
