export interface SheetData {
  [sheetName: string]: any[][];
}

export interface ChangeEvent {
  changeType: 'EDIT' | 'INSERT_ROW' | 'INSERT_COLUMN' | 'REMOVE_ROW' | 'REMOVE_COLUMN' | 'INSERT_GRID' | 'REMOVE_GRID' | 'FORMAT' | 'OTHER';
  sheetName: string;
  affectedRange: {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
    a1Notation: string;
  };
  cellAddress?: string;
  oldValue?: any;
  newValue?: any;
  rowIndex?: number;
  columnIndex?: number;
  insertedData?: any[][];
  deletedData?: any[][];
  timestamp: string;
}

export interface DriveNotification {
  kind: string;
  id: string;
  resourceId: string;
  resourceUri: string;
  resourceState: string;
  channelId: string;
  expiration?: string;
}

