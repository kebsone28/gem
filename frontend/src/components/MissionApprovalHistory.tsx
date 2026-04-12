import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Hourglass } from 'lucide-react';
import type { ApprovalRole } from '../constants/approvalConstants';
import {
  getMissionApprovalHistory,
  approveMissionStep,
  rejectMissionStep,
  overrideMissionOrderNumber,
  canApproveMissionStep,
} from '../services/missionApprovalService';
import logger from '../utils/logger';
import './MissionApprovalHistory.css';

interface ApprovalStep {
  role: string;
  label: string;
  sequence: number;
  status: string;
  decidedBy?: string;
  decidedAt?: string;
  comment?: string;
}

interface MissionApprovalHistoryProps {
  missionId: string;
  missionOrderNumber?: string;
  userRole?: string;
  isAdmin?: boolean;
  onApprovalChanged?: () => void;
}

const MissionApprovalHistory: React.FC<MissionApprovalHistoryProps> = ({
  missionId,
  missionOrderNumber,
  userRole,
  isAdmin = false,
  onApprovalChanged,
}) => {
  const [workflow, setWorkflow] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedRole, setSelectedRole] = useState<ApprovalRole | null>(null);
  const [overrideOrderNumberOpen, setOverrideOrderNumberOpen] = useState(false);
  const [newOrderNumber, setNewOrderNumber] = useState('');

  // Workflow roles in sequence (Simplified)
  const WORKFLOW_SEQUENCE: { role: ApprovalRole; label: string; sequence: number }[] = [
    { role: 'DIRECTEUR', label: '👔 Validation Direction Générale', sequence: 1 },
  ];

  useEffect(() => {
    fetchApprovalHistory();
    const interval = setInterval(fetchApprovalHistory, 5000);
    return () => clearInterval(interval);
  }, [missionId]);

  const fetchApprovalHistory = async () => {
    if (!missionId) {
      setLoading(false);
      return;
    }
    try {
      const data = await getMissionApprovalHistory(missionId);
      setWorkflow(data);
      setError(null);
    } catch (err) {
      logger.error('Error fetching approval history:', err);
      setError("Impossible de charger l'historique d'approbation");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (role: ApprovalRole) => {
    setApproving(role);
    try {
      const updated = await approveMissionStep(missionId, role);
      if (updated) {
        setWorkflow(updated);
        if (role === 'DIRECTEUR' && updated.orderNumber) {
          logger.log(`✅ Mission approved by DG. Order number generated: ${updated.orderNumber}`);
        }
        onApprovalChanged?.();
      }
    } catch (err) {
      logger.error('Approval failed:', err);
      setError("Erreur lors de l'approbation");
    } finally {
      setApproving(null);
    }
  };

  const handleAdminApproveAll = async () => {
    setApproving('ADMIN');
    try {
      const updated = await approveMissionStep(missionId, 'ADMIN');
      if (updated) {
        setWorkflow(updated);
        logger.log(
          `✅ Mission approved by Admin (all steps). Order number: ${updated.orderNumber}`
        );
        onApprovalChanged?.();
      }
    } catch (err) {
      logger.error('Admin approval failed:', err);
      setError("Erreur lors de l'approbation admin");
    } finally {
      setApproving(null);
    }
  };

  const handleRejectClick = (role: ApprovalRole) => {
    setSelectedRole(role);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedRole || !rejectReason.trim()) return;

    setApproving(selectedRole);
    try {
      const updated = await rejectMissionStep(missionId, selectedRole, rejectReason);
      if (updated) {
        setWorkflow(updated);
        onApprovalChanged?.();
      }
    } catch (err) {
      logger.error('Rejection failed:', err);
      setError('Erreur lors du rejet');
    } finally {
      setApproving(null);
      setRejectDialogOpen(false);
      setRejectReason('');
      setSelectedRole(null);
    }
  };

  const handleOverrideOrderNumber = async () => {
    if (!newOrderNumber.trim()) {
      setError('Le numéro de mission ne peut pas être vide.');
      return;
    }

    setApproving('ADMIN');
    try {
      const updated = await overrideMissionOrderNumber(missionId, newOrderNumber.trim());
      if (updated) {
        setWorkflow(updated);
        setError(null);
        logger.log(`✅ Numéro de mission overridé à ${newOrderNumber.trim()}`);
      }
    } catch (err) {
      logger.error('Override order number failed:', err);
      setError('Erreur lors de la modification du numéro de mission');
    } finally {
      setApproving(null);
      setOverrideOrderNumberOpen(false);
      setNewOrderNumber('');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROUVE':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'REJETE':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'EN_ATTENTE':
        return <Hourglass className="w-5 h-5 text-yellow-500" />;
      default:
        return <Hourglass className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROUVE':
        return 'bg-green-50 border-green-300';
      case 'REJETE':
        return 'bg-red-50 border-red-300';
      case 'EN_ATTENTE':
        return 'bg-yellow-50 border-yellow-300';
      default:
        return 'bg-gray-50 border-gray-300';
    }
  };

  const canUserApprove = (step: ApprovalStep) => {
    if (!workflow) return false;
    if (workflow.overallStatus === 'approved' || workflow.overallStatus === 'rejected')
      return false;
    return canApproveMissionStep(userRole, step as any, isAdmin);
  };

  if (loading) {
    return (
      <div className="mission-approval-container">
        <div className="approval-loading">Loading approval workflow...</div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="mission-approval-container">
        <p className="text-gray-500">Aucune information d'approbation disponible</p>
      </div>
    );
  }

  const isApproved = workflow.overallStatus === 'approved';
  const isRejected = workflow.overallStatus === 'rejected';

  return (
    <div className="mission-approval-container">
      <div className="approval-header">
        <h3>📋 HISTORIQUE APPROBATIONS</h3>
        {workflow.orderNumber && (
          <div className="order-number-badge">
            <strong>Numéro de Mission:</strong> {workflow.orderNumber}
          </div>
        )}
      </div>

      {missionOrderNumber && (
        <div className="bg-blue-50/50 p-2 rounded-lg mb-4 text-xs text-blue-600 font-bold border border-blue-100 uppercase tracking-widest text-center">
          Ordre de Mission: {missionOrderNumber}
        </div>
      )}

      {error && (
        <div className="approval-error">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* ADMIN SUPER-POWER BUTTON */}
      {isAdmin && !isApproved && !isRejected && (
        <div className="admin-super-power">
          <button
            onClick={handleAdminApproveAll}
            disabled={approving === 'ADMIN'}
            className="btn-admin-approve-all"
          >
            🔑 {approving === 'ADMIN' ? 'Approbation en cours...' : 'APPROUVER TOUT (Admin)'}
          </button>
          <p className="text-xs text-gray-600">
            Super-pouvoir: Approuve toutes les étapes en une seule action et génère le numéro
          </p>
        </div>
      )}

      {/* WORKFLOW STEPS */}
      <div className="approval-workflow">
        {WORKFLOW_SEQUENCE.map((step) => {
          const stepData = workflow.steps?.find((s: ApprovalStep) => s.role === step.role) || {
            role: step.role,
            label: step.label,
            sequence: step.sequence,
            status: 'EN_ATTENTE',
          };

          const isCurrentStep = workflow.currentStep === step.sequence;
          const isCompleted = stepData.status === 'APPROUVE' || stepData.status === 'approved';
          const isRejectedStep = stepData.status === 'REJETE' || stepData.status === 'rejected';
          const canApprove = canUserApprove(stepData);

          return (
            <div
              key={step.role}
              className={`approval-step ${getStatusColor(stepData.status)} ${isCurrentStep ? 'current-step' : ''}`}
            >
              <div className="step-header">
                <div className="step-info">
                  <div className="step-icon">{getStatusIcon(stepData.status)}</div>
                  <div className="step-details">
                    <h4>{step.label}</h4>
                    <span className="status-badge">{stepData.status}</span>
                  </div>
                </div>
              </div>

              {stepData.comment && (
                <div className="step-comment">
                  <p>{stepData.comment}</p>
                  {stepData.decidedAt && (
                    <small>
                      par {stepData.decidedBy} le{' '}
                      {new Date(stepData.decidedAt).toLocaleDateString('fr-FR')}
                    </small>
                  )}
                </div>
              )}

              {/* ACTION BUTTONS */}
              {isCurrentStep && !isCompleted && !isRejectedStep && canApprove && (
                <div className="step-actions">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ajouter un commentaire..."
                    className="comment-input"
                    rows={2}
                  />
                  <div className="button-group">
                    <button
                      onClick={() => handleApprove(step.role)}
                      disabled={approving === step.role}
                      className="btn btn-approve"
                    >
                      ✓ APPROUVER
                    </button>
                    <button
                      onClick={() => handleRejectClick(step.role)}
                      disabled={approving === step.role}
                      className="btn btn-reject"
                    >
                      ✗ REJETER
                    </button>
                  </div>
                </div>
              )}

              {isCompleted && step.sequence < 2 && (
                <div className="step-completed">
                  ✓ Approuvé
                  {stepData.decidedAt && (
                    <small>{new Date(stepData.decidedAt).toLocaleDateString('fr-FR')}</small>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FINAL STATUS */}
      <div className="approval-footer">
        {isApproved && (
          <div className="status-approved">
            <CheckCircle2 className="w-6 h-6" />
            <div>
              <h4>✅ Approbation Complète</h4>
              <p>
                Numéro de mission généré: <strong>{workflow.orderNumber}</strong>
              </p>
              {isAdmin && (
                <button
                  onClick={() => setOverrideOrderNumberOpen(true)}
                  className="btn-override-order"
                >
                  Modifier le numéro
                </button>
              )}
            </div>
          </div>
        )}

        {isRejected && (
          <div className="status-rejected">
            <AlertCircle className="w-6 h-6" />
            <div>
              <h4>❌ Mission Rejetée</h4>
              <p>La mission doit être modifiée et resoumise pour approbation</p>
            </div>
          </div>
        )}

        {!isApproved && !isRejected && (
          <div className="status-pending">
            <Hourglass className="w-6 h-6" />
            <div>
              <h4>⏳ En Attente d'Approbation</h4>
              <p>
                Étape {workflow.currentStep}/1: Attente de la validation par{' '}
                {WORKFLOW_SEQUENCE.find((s) => s.sequence === workflow.currentStep)?.label}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* REJECT CONFIRMATION DIALOG */}
      {rejectDialogOpen && (
        <div className="modal-overlay" onClick={() => setRejectDialogOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Rejeter la Mission</h3>
            <p>Veuillez entrer le motif du rejet:</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motif du rejet..."
              rows={4}
              className="reject-textarea"
            />
            <div className="modal-actions">
              <button onClick={() => setRejectDialogOpen(false)} className="btn btn-cancel">
                Annuler
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={!rejectReason.trim() || approving === selectedRole}
                className="btn btn-reject"
              >
                {approving === selectedRole ? 'Rejet en cours...' : 'REJETER'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORDER NUMBER OVERRIDE DIALOG (ADMIN ONLY) */}
      {overrideOrderNumberOpen && isAdmin && (
        <div className="modal-overlay" onClick={() => setOverrideOrderNumberOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Modifier le Numéro de Mission</h3>
            <p>
              Numéro actuel: <strong>{workflow.orderNumber}</strong>
            </p>
            <input
              type="text"
              value={newOrderNumber}
              onChange={(e) => setNewOrderNumber(e.target.value)}
              placeholder="Nouveau numéro de mission..."
              className="override-input"
            />
            <div className="modal-actions">
              <button onClick={() => setOverrideOrderNumberOpen(false)} className="btn btn-cancel">
                Annuler
              </button>
              <button
                onClick={handleOverrideOrderNumber}
                disabled={approving === 'ADMIN'}
                className="btn btn-approve"
              >
                {approving === 'ADMIN' ? 'Modification en cours...' : 'Modifier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MissionApprovalHistory;
