import { SheetData, ChangeEvent } from './types';

export class ChangeDetector {
  detectChanges(
    previousData: SheetData,
    currentData: SheetData
  ): ChangeEvent[] {
    const changes: ChangeEvent[] = [];

    // Get all sheet names from both states
    const allSheetNames = new Set([
      ...Object.keys(previousData),
      ...Object.keys(currentData),
    ]);

    for (const sheetName of allSheetNames) {
      const previous = previousData[sheetName] || [];
      const current = currentData[sheetName] || [];

      // Skip empty sheets
      if (previous.length === 0 && current.length === 0) continue;

      // Phase 1: Column-level matching (by header name)
      const columnChanges = this.detectColumnChanges(previous, current, sheetName);
      changes.push(...columnChanges);

      // Phase 2: Row-level matching (by primary key - first column)
      const rowChanges = this.detectRowChanges(previous, current, sheetName);
      changes.push(...rowChanges);

      // Phase 3: Cell edits (only for matched rows, using column mapping)
      // Only checks columns that exist in both versions (skips newly added columns)
      const cellChanges = this.detectCellEdits(previous, current, sheetName);
      changes.push(...cellChanges);
    }

    return changes;
  }

  /**
   * Phase 1: Detect column insertions and deletions by matching header names.
   * Time Complexity: O(n) where n = number of columns
   */
  private detectColumnChanges(
    previous: any[][],
    current: any[][],
    sheetName: string
  ): ChangeEvent[] {
    const changes: ChangeEvent[] = [];

    // Get header rows (first row, row index 0)
    const prevHeader = previous.length > 0 ? previous[0] : [];
    const currHeader = current.length > 0 ? current[0] : [];

    // Build hash map: headerName -> previousColumnIndex
    const prevColMap = new Map<string, number>();
    prevHeader.forEach((headerName, index) => {
      const normalizedName = this.normalizeValue(headerName);
      if (!prevColMap.has(normalizedName)) {
        prevColMap.set(normalizedName, index);
      }
    });

    // Build hash map: headerName -> currentColumnIndex
    const currColMap = new Map<string, number>();
    currHeader.forEach((headerName, index) => {
      const normalizedName = this.normalizeValue(headerName);
      if (!currColMap.has(normalizedName)) {
        currColMap.set(normalizedName, index);
      }
    });

    // Find inserted columns (in current but not in previous)
    for (const [headerName, currColIdx] of currColMap.entries()) {
      if (!prevColMap.has(headerName)) {
        const maxRow = Math.max(previous.length, current.length);
        changes.push({
          changeType: 'INSERT_COLUMN',
          sheetName,
          affectedRange: {
            startRow: 1,
            endRow: maxRow,
            startColumn: currColIdx + 1, // 1-indexed
            endColumn: currColIdx + 1,
            a1Notation: `${this.columnToLetter(currColIdx + 1)}1:${this.columnToLetter(currColIdx + 1)}${maxRow}`,
          },
          columnIndex: currColIdx + 1,
          insertedData: current.length > 1 
            ? current.slice(1).map(row => [row[currColIdx] || '']).filter(([val]) => val !== '')
            : [],
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Find deleted columns (in previous but not in current)
    for (const [headerName, prevColIdx] of prevColMap.entries()) {
      if (!currColMap.has(headerName)) {
        const maxRow = Math.max(previous.length, current.length);
        changes.push({
          changeType: 'REMOVE_COLUMN',
          sheetName,
          affectedRange: {
            startRow: 1,
            endRow: maxRow,
            startColumn: prevColIdx + 1, // 1-indexed
            endColumn: prevColIdx + 1,
            a1Notation: `${this.columnToLetter(prevColIdx + 1)}1:${this.columnToLetter(prevColIdx + 1)}${maxRow}`,
          },
          columnIndex: prevColIdx + 1,
          deletedData: previous.length > 1
            ? previous.slice(1).map(row => [row[prevColIdx] || '']).filter(([val]) => val !== '')
            : [],
          timestamp: new Date().toISOString(),
        });
      }
    }

    return changes;
  }

  /**
   * Phase 2: Detect row insertions and deletions by matching primary key (first column).
   * Time Complexity: O(n) where n = number of rows
   */
  private detectRowChanges(
    previous: any[][],
    current: any[][],
    sheetName: string
  ): ChangeEvent[] {
    const changes: ChangeEvent[] = [];

    // Skip header row (row 0) - only compare data rows
    const prevDataRows = previous.length > 1 ? previous.slice(1) : [];
    const currDataRows = current.length > 1 ? current.slice(1) : [];

    // Build hash map: primaryKey -> previousRowIndex
    // NOTE: Rows with empty primary keys (first column) will not be matched
    // and may appear as inserted/deleted on every change detection
    const prevRowMap = new Map<string, number>();
    prevDataRows.forEach((row, index) => {
      const primaryKey = this.normalizeValue(row[0]); // First column is primary key
      if (primaryKey && !prevRowMap.has(primaryKey)) {
        prevRowMap.set(primaryKey, index);
      }
    });

    // Build hash map: primaryKey -> currentRowIndex
    // NOTE: Rows with empty primary keys (first column) will not be matched
    // and may appear as inserted/deleted on every change detection
    const currRowMap = new Map<string, number>();
    currDataRows.forEach((row, index) => {
      const primaryKey = this.normalizeValue(row[0]); // First column is primary key
      if (primaryKey && !currRowMap.has(primaryKey)) {
        currRowMap.set(primaryKey, index);
      }
    });

    // Find inserted rows (in current but not in previous)
    for (const [primaryKey, currRowIdx] of currRowMap.entries()) {
      if (!prevRowMap.has(primaryKey)) {
        const actualRowNum = currRowIdx + 2; // +1 for 1-indexed, +1 for header row
        const row = currDataRows[currRowIdx];
        const maxCol = Math.max(
          ...prevDataRows.map(r => r.length),
          ...currDataRows.map(r => r.length),
          row.length
        );

        changes.push({
          changeType: 'INSERT_ROW',
          sheetName,
          affectedRange: {
            startRow: actualRowNum,
            endRow: actualRowNum,
            startColumn: 1,
            endColumn: maxCol,
            a1Notation: `${actualRowNum}:${actualRowNum}`,
          },
          rowIndex: actualRowNum,
          insertedData: [row],
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Find deleted rows (in previous but not in current)
    for (const [primaryKey, prevRowIdx] of prevRowMap.entries()) {
      if (!currRowMap.has(primaryKey)) {
        const actualRowNum = prevRowIdx + 2; // +1 for 1-indexed, +1 for header row
        const row = prevDataRows[prevRowIdx];
        const maxCol = Math.max(
          ...prevDataRows.map(r => r.length),
          ...currDataRows.map(r => r.length),
          row.length
        );

        changes.push({
          changeType: 'REMOVE_ROW',
          sheetName,
          affectedRange: {
            startRow: actualRowNum,
            endRow: actualRowNum,
            startColumn: 1,
            endColumn: maxCol,
            a1Notation: `${actualRowNum}:${actualRowNum}`,
          },
          rowIndex: actualRowNum,
          deletedData: [row],
          timestamp: new Date().toISOString(),
        });
      }
    }

    return changes;
  }

  /**
   * Phase 3: Detect cell edits in existing rows (matched by primary key).
   * Only checks rows that exist in both versions, using column mapping.
   * IMPORTANT: Only checks columns that exist in BOTH versions (skips newly added columns).
   * Time Complexity: O(matched_rows × matched_columns)
   */
  private detectCellEdits(
    previous: any[][],
    current: any[][],
    sheetName: string
  ): ChangeEvent[] {
    const changes: ChangeEvent[] = [];

    // Skip header row
    const prevDataRows = previous.length > 1 ? previous.slice(1) : [];
    const currDataRows = current.length > 1 ? current.slice(1) : [];

    // Build column mapping: headerName -> {prevIndex, currIndex}
    // Only includes columns that exist in BOTH versions (excludes newly added/deleted columns)
    const prevHeader = previous.length > 0 ? previous[0] : [];
    const currHeader = current.length > 0 ? current[0] : [];
    
    const columnMapping = new Map<string, { prevIdx: number; currIdx: number }>();
    const prevColMap = new Map<string, number>();
    const currColMap = new Map<string, number>();

    prevHeader.forEach((name, idx) => {
      const normalized = this.normalizeValue(name);
      if (!prevColMap.has(normalized)) {
        prevColMap.set(normalized, idx);
      }
    });

    currHeader.forEach((name, idx) => {
      const normalized = this.normalizeValue(name);
      if (!currColMap.has(normalized)) {
        currColMap.set(normalized, idx);
      }
    });

    // Build mapping for columns that exist in both (excludes newly added/deleted columns)
    for (const [headerName, prevIdx] of prevColMap.entries()) {
      if (currColMap.has(headerName)) {
        columnMapping.set(headerName, {
          prevIdx,
          currIdx: currColMap.get(headerName)!
        });
      }
    }

    // Build row mapping by primary key: primaryKey -> {prevRowIdx, currRowIdx}
    // NOTE: Rows with empty primary keys (first column) will not be matched
    // and will be skipped in cell edit detection
    const prevRowMap = new Map<string, number>();
    const currRowMap = new Map<string, number>();

    prevDataRows.forEach((row, idx) => {
      const pk = this.normalizeValue(row[0]);
      if (pk && !prevRowMap.has(pk)) {
        prevRowMap.set(pk, idx);
      }
    });

    currDataRows.forEach((row, idx) => {
      const pk = this.normalizeValue(row[0]);
      if (pk && !currRowMap.has(pk)) {
        currRowMap.set(pk, idx);
      }
    });

    // Find matched rows (exist in both) and check cell edits
    // Only check columns that exist in both versions (skip newly added columns)
    for (const [primaryKey, prevRowIdx] of prevRowMap.entries()) {
      if (!currRowMap.has(primaryKey)) continue; // Skip deleted rows

      const currRowIdx = currRowMap.get(primaryKey)!;
      const prevRow = prevDataRows[prevRowIdx];
      const currRow = currDataRows[currRowIdx];
      const actualRowNum = currRowIdx + 2; // +1 for 1-indexed, +1 for header

      // Check each column that exists in both versions (excludes newly added columns)
      for (const [headerName, { prevIdx, currIdx }] of columnMapping.entries()) {
        // Skip primary key column (first column) - it shouldn't change
        if (prevIdx === 0 && currIdx === 0) continue;

        const prevValue = prevRow[prevIdx] !== undefined ? prevRow[prevIdx] : '';
        const currValue = currRow[currIdx] !== undefined ? currRow[currIdx] : '';

        const prevNormalized = this.normalizeValue(prevValue);
        const currNormalized = this.normalizeValue(currValue);

        if (prevNormalized !== currNormalized) {
          const colLetter = this.columnToLetter(currIdx + 1);
          const cellAddress = `${colLetter}${actualRowNum}`;

          changes.push({
            changeType: 'EDIT',
            sheetName,
            affectedRange: {
              startRow: actualRowNum,
              endRow: actualRowNum,
              startColumn: currIdx + 1,
              endColumn: currIdx + 1,
              a1Notation: cellAddress,
            },
            cellAddress,
            oldValue: prevValue,
            newValue: currValue,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    return changes;
  }

  /**
   * Normalize value for comparison (handles null, undefined, empty strings)
   */
  private normalizeValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim();
  }

  /**
   * Convert column number to letter (1 -> A, 2 -> B, 27 -> AA, etc.)
   */
  private columnToLetter(column: number): string {
    let result = '';
    while (column > 0) {
      column--;
      result = String.fromCharCode(65 + (column % 26)) + result;
      column = Math.floor(column / 26);
    }
    return result;
  }
}

