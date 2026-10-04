/**
 * @template Row
 * @typedef {{
 *   key: string,
 *   header: string,
 *   render: (row: Row, index: number) => import("react").ReactNode,
 *   cellClassName?: (row: Row) => string | undefined,
 * }} Column
 */

/**
 * Plain data table. `rowKey` must return a stable, unique id; never pass the array index.
 * @template Row
 * @param {{ columns: Column<Row>[], rows: Row[], rowKey: (row: Row) => string, scroll?: boolean }} props
 */
export default function DataTable({ columns, rows, rowKey, scroll = false }) {
  const table = (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={rowKey(row)}>
            {columns.map((col) => (
              <td key={col.key} className={col.cellClassName?.(row)}>
                {col.render(row, i)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
  return scroll ? <div className="data-table__scroll">{table}</div> : table;
}
