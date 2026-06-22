// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MissionApprovalHistory from './MissionApprovalHistory';
import * as approvalService from '../services/missionApprovalService';
import { syncEventBus, SYNC_EVENTS } from '../utils/syncEventBus';

vi.mock('../services/missionApprovalService');

const mockWorkflow = {
  missionId: 'mission-123',
  orderNumber: '20/2026',
  overallStatus: 'in_progress',
  currentStep: 1,
  steps: [
    {
      role: 'DIRECTEUR',
      status: 'EN_ATTENTE',
      decidedBy: undefined,
      decidedAt: undefined,
      comment: undefined,
    },
  ],
  createdAt: '2026-03-05T09:00:00Z',
  updatedAt: '2026-03-05T10:30:00Z',
};

const mockApprovedWorkflow = {
  ...mockWorkflow,
  overallStatus: 'approved',
  steps: mockWorkflow.steps.map((s) => ({
    ...s,
    status: 'APPROUVE',
    decidedBy: 'Test User',
    decidedAt: new Date().toISOString(),
    comment: 'Approved by director',
  })),
};

describe('MissionApprovalHistory Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(approvalService.getMissionApprovalHistory).mockResolvedValue(mockWorkflow);
    vi.mocked(approvalService.canApproveMissionStep).mockReturnValue(true);
  });

  describe('Rendering', () => {
    it('should render loading state initially', async () => {
      vi.mocked(approvalService.getMissionApprovalHistory).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockWorkflow), 100))
      );
      render(<MissionApprovalHistory missionId="mission-123" missionOrderNumber="20/2026" />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should render approval workflow complete', async () => {
      render(<MissionApprovalHistory missionId="mission-123" missionOrderNumber="20/2026" />);

      await waitFor(() => {
        expect(screen.getByText(/HISTORIQUE APPROBATIONS/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/En Attente de Validation/)).toBeInTheDocument();
      expect(screen.getByText(/Validation Finale/)).toBeInTheDocument();
      expect(screen.getByText(/Numéro de Mission:/)).toBeInTheDocument();
    });

    it('should show error message on fetch failure', async () => {
      vi.mocked(approvalService.getMissionApprovalHistory).mockRejectedValue(
        new Error('Network error')
      );

      render(<MissionApprovalHistory missionId="mission-123" missionOrderNumber="20/2026" />);

      await waitFor(() => {
        expect(screen.getByText(/Impossible de charger/i)).toBeInTheDocument();
      });
    });
  });

  describe('Approval Workflow Status', () => {
    it('should show "approved" status when all steps approved', async () => {
      vi.mocked(approvalService.getMissionApprovalHistory).mockResolvedValueOnce(
        mockApprovedWorkflow
      );

      render(<MissionApprovalHistory missionId="mission-123" missionOrderNumber="20/2026" />);

      await waitFor(() => {
        expect(screen.getByText(/Approbation Complète/)).toBeInTheDocument();
        expect(screen.getAllByText(/20\/2026/).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should show "pending" status when no approvals yet', async () => {
      render(<MissionApprovalHistory missionId="mission-123" missionOrderNumber="20/2026" />);

      await waitFor(() => {
        expect(screen.getByText(/En Attente de Validation/)).toBeInTheDocument();
      });
    });

    it('should show "rejected" status when step rejected', async () => {
      const rejectedWorkflow = {
        ...mockWorkflow,
        overallStatus: 'rejected',
        steps: [{ ...mockWorkflow.steps[0], status: 'REJETE', comment: 'Missing details' }],
      };

      vi.mocked(approvalService.getMissionApprovalHistory).mockResolvedValueOnce(
        rejectedWorkflow
      );

      render(<MissionApprovalHistory missionId="mission-123" missionOrderNumber="20/2026" />);

      await waitFor(() => {
        expect(screen.getByText(/Mission Rejetée/)).toBeInTheDocument();
      });
    });
  });

  describe('Admin Super Power', () => {
    it('should show admin validate button for admin users', async () => {
      render(
        <MissionApprovalHistory
          missionId="mission-123"
          missionOrderNumber="20/2026"
          userRole="ADMIN"
          isAdmin={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/VALIDER \(Admin\)/)).toBeInTheDocument();
      });
    });

    it('should hide admin validate button for non-admin users', async () => {
      render(
        <MissionApprovalHistory
          missionId="mission-123"
          missionOrderNumber="20/2026"
          userRole="CHEF_PROJET"
          isAdmin={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Validation Finale/)).toBeInTheDocument();
      });

      expect(screen.queryByText(/VALIDER \(Admin\)/)).not.toBeInTheDocument();
    });
  });

  describe('Step Actions', () => {
    it('should show approve and reject buttons when step is current and user has permission', async () => {
      render(
        <MissionApprovalHistory
          missionId="mission-123"
          missionOrderNumber="20/2026"
          userRole="ADMIN"
          isAdmin={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/APPROUVER/)).toBeInTheDocument();
        expect(screen.getByText(/REJETER/)).toBeInTheDocument();
      });
    });

    it('should call approve service when approve button clicked', async () => {
      vi.mocked(approvalService.approveMissionStep).mockResolvedValueOnce(mockApprovedWorkflow);

      render(
        <MissionApprovalHistory
          missionId="mission-123"
          missionOrderNumber="20/2026"
          userRole="ADMIN"
          isAdmin={true}
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText(/APPROUVER/));
      });

      await waitFor(() => {
        expect(approvalService.approveMissionStep).toHaveBeenCalled();
      });
    });

    it('should open reject dialog when reject button clicked', async () => {
      render(
        <MissionApprovalHistory
          missionId="mission-123"
          missionOrderNumber="20/2026"
          userRole="ADMIN"
          isAdmin={true}
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText(/REJETER/));
      });

      await waitFor(() => {
        expect(screen.getByText(/Rejeter la Mission/)).toBeInTheDocument();
      });
    });

    it('should call reject service with reason', async () => {
      vi.mocked(approvalService.rejectMissionStep).mockResolvedValueOnce(mockWorkflow);

      render(
        <MissionApprovalHistory
          missionId="mission-123"
          missionOrderNumber="20/2026"
          userRole="ADMIN"
          isAdmin={true}
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText(/REJETER/));
      });

      const textarea = screen.getByPlaceholderText(/Motif du rejet/);
      fireEvent.change(textarea, { target: { value: 'Missing information' } });

      fireEvent.click(screen.getByText('REJETER'));

      await waitFor(() => {
        expect(approvalService.rejectMissionStep).toHaveBeenCalledWith(
          'mission-123',
          'DIRECTEUR',
          'Missing information'
        );
      });
    });

    it('should call onApprovalChanged callback', async () => {
      const mockCallback = vi.fn();
      vi.mocked(approvalService.approveMissionStep).mockResolvedValueOnce(mockApprovedWorkflow);

      render(
        <MissionApprovalHistory
          missionId="mission-123"
          missionOrderNumber="20/2026"
          userRole="ADMIN"
          isAdmin={true}
          onApprovalChanged={mockCallback}
        />
      );

      const approveBtn = await screen.findByText(/APPROUVER/);
      fireEvent.click(approveBtn);

      await waitFor(() => {
        expect(mockCallback).toHaveBeenCalled();
      });
    });
  });

  describe('Order Number Override', () => {
    it('should call override API when admin modifies order number', async () => {
      vi.mocked(approvalService.getMissionApprovalHistory).mockResolvedValueOnce(
        mockApprovedWorkflow
      );
      vi.mocked(approvalService.overrideMissionOrderNumber).mockResolvedValueOnce({
        ...mockApprovedWorkflow,
        orderNumber: 'MISSION-2026-00099',
      });

      render(
        <MissionApprovalHistory
          missionId="mission-123"
          missionOrderNumber="20/2026"
          userRole="ADMIN"
          isAdmin={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Numéro de Mission:/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Modifier le numéro/));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Nouveau numéro de mission/)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText(/Nouveau numéro de mission/), {
        target: { value: 'MISSION-2026-00099' },
      });
      fireEvent.click(screen.getByText('Modifier'));

      await waitFor(() => {
        expect(approvalService.overrideMissionOrderNumber).toHaveBeenCalledWith(
          'mission-123',
          'MISSION-2026-00099'
        );
      });
    });
  });

  describe('Event-Driven Refresh', () => {
    it('should refetch when mission:update event fires', async () => {
      render(<MissionApprovalHistory missionId="mission-123" missionOrderNumber="20/2026" />);

      await waitFor(() => {
        expect(approvalService.getMissionApprovalHistory).toHaveBeenCalledTimes(1);
      });

      syncEventBus.emit(SYNC_EVENTS.MISSION_UPDATED, { missionId: 'mission-123' });

      await waitFor(() => {
        expect(approvalService.getMissionApprovalHistory).toHaveBeenCalledTimes(2);
      });
    });

    it('should refetch when mission:certified event fires', async () => {
      render(<MissionApprovalHistory missionId="mission-123" missionOrderNumber="20/2026" />);

      await waitFor(() => {
        expect(approvalService.getMissionApprovalHistory).toHaveBeenCalledTimes(1);
      });

      syncEventBus.emit(SYNC_EVENTS.MISSION_CERTIFIED, { missionId: 'mission-123' });

      await waitFor(() => {
        expect(approvalService.getMissionApprovalHistory).toHaveBeenCalledTimes(2);
      });
    });

    it('should unsubscribe on unmount', async () => {
      const { unmount } = render(
        <MissionApprovalHistory missionId="mission-123" missionOrderNumber="20/2026" />
      );

      await waitFor(() => {
        expect(approvalService.getMissionApprovalHistory).toHaveBeenCalledTimes(1);
      });

      unmount();

      syncEventBus.emit(SYNC_EVENTS.MISSION_UPDATED, { missionId: 'mission-123' });

      // Wait a tick to let any handler run
      await new Promise((r) => setTimeout(r, 50));

      expect(approvalService.getMissionApprovalHistory).toHaveBeenCalledTimes(1);
    });
  });

  describe('Step Details Display', () => {
    it('should show approved step details', async () => {
      vi.mocked(approvalService.getMissionApprovalHistory).mockResolvedValueOnce(
        mockApprovedWorkflow
      );

      render(<MissionApprovalHistory missionId="mission-123" missionOrderNumber="20/2026" />);

      await waitFor(() => {
        expect(screen.getByText(/Test User/)).toBeInTheDocument();
        expect(screen.getByText(/Approved by director/)).toBeInTheDocument();
      });
    });

    it('should not show details for pending steps', async () => {
      render(<MissionApprovalHistory missionId="mission-123" missionOrderNumber="20/2026" />);

      await waitFor(() => {
        const stepLabel = screen.getByText(/Validation Finale/);
        expect(stepLabel).toBeInTheDocument();
      });

      expect(screen.queryByText(/par \w+ le/)).not.toBeInTheDocument();
    });
  });
});
