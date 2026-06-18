import type { CalculationResult, LineItem } from '../api/types';
import { currencySymbol, formatMoney } from '../lib/format';
import { IconShield } from './icons';

interface GroupDef {
  key: keyof CalculationResult['breakdown'];
  title: string;
  cls: string;
}

const GROUPS: GroupDef[] = [
  { key: 'earnings', title: 'Earnings', cls: 'earnings' },
  { key: 'employeeDeductions', title: 'Employee Deductions', cls: 'empded' },
  { key: 'employerContributions', title: 'Employer Contributions', cls: 'employer' },
  { key: 'taxes', title: 'Taxes', cls: 'tax' },
  { key: 'exemptions', title: 'Exemptions & Reliefs', cls: 'exempt' },
];

function sumLines(lines: LineItem[]): number {
  return lines.reduce((acc, l) => acc + (l.amount ?? 0), 0);
}

function Group({
  def,
  lines,
  currency,
  showRuleKey,
}: {
  def: GroupDef;
  lines: LineItem[];
  currency: string;
  showRuleKey: boolean;
}) {
  if (!lines || lines.length === 0) return null;
  const sym = currencySymbol(currency);
  return (
    <div className={`pgroup ${def.cls}`}>
      <div className="pgroup-head">
        <span className="pgroup-bar" />
        <span className="pgroup-title">{def.title}</span>
        <span className="pgroup-total">
          {sym}
          {formatMoney(sumLines(lines))}
        </span>
      </div>
      <table className="line-table">
        <tbody>
          {lines.map((l) => (
            <tr key={l.ruleKey + l.label}>
              <td>
                <span className="line-label">{l.label}</span>
                {l.explanation && <span className="line-explain">{l.explanation}</span>}
              </td>
              {showRuleKey && (
                <td className="line-rulekey" aria-label="rule key">
                  {l.ruleKey}
                </td>
              )}
              <td className="line-amount">
                {sym}
                {formatMoney(l.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Renders a CalculationResult's full breakdown grouped into
 * Earnings / Employee Deductions / Employer Contributions / Taxes / Exemptions,
 * plus a reconciliation summary. Money is right-aligned monospaced.
 *
 * `variant="full"` shows rule keys + the audit footer (the hero detail screen).
 * `variant="preview"` is the compact live preview in the Add-employee drawer.
 */
export function PayslipBreakdown({
  result,
  currency,
  variant = 'full',
}: {
  result: CalculationResult;
  currency: string;
  variant?: 'full' | 'preview';
}) {
  const { breakdown, summary } = result;
  const sym = currencySymbol(currency);
  const showRuleKey = variant === 'full';

  return (
    <div className="payslip-detail-inner">
      {GROUPS.map((g) => (
        <Group
          key={g.key}
          def={g}
          lines={breakdown[g.key]}
          currency={currency}
          showRuleKey={showRuleKey}
        />
      ))}

      <div className="payslip-recon">
        <div className="recon-row">
          <span className="lbl">Gross earnings</span>
          <span className="amt">
            {sym}
            {formatMoney(summary.gross)}
          </span>
        </div>
        <div className="recon-row">
          <span className="lbl">Total employee deductions</span>
          <span className="amt">
            −{sym}
            {formatMoney(summary.totalEmployeeDeductions)}
          </span>
        </div>
        <div className="recon-row net">
          <span className="lbl">Net pay</span>
          <span className="amt">
            {sym}
            {formatMoney(summary.netPay)}
          </span>
        </div>
        <div className="recon-row cost">
          <span className="lbl">Total cost to company</span>
          <span className="amt">
            {sym}
            {formatMoney(summary.totalEmployerCost)}
          </span>
        </div>
      </div>

      {variant === 'full' && (
        <div className="alert alert-info mt-16" style={{ fontSize: 12.5 }}>
          <IconShield size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Every line traces to a rule key in ruleset{' '}
            <strong className="mono">{result.rulesetVersion}</strong>. Reconciliation
            holds: gross − deductions = net.
          </span>
        </div>
      )}
    </div>
  );
}
