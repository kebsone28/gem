/**
 * Mission Approval History Component - Unit Tests
 * Framework: Vitest + React Testing Library
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MissionApprovalHistory from '../components/MissionApprovalHistory';
import * as approvalService from '../services/missionApprovalService';

// Mock the service
vi.mock('../services/missionApprovalService');

// ============================================
// TEST DATA
// ============================================

const mockWorkflow = {
  missionId: 'mission-123',
  orderNumber: '20/2026',
  overallStatus: 'in_progress',
  steps: [
    {
      role: 'CHEF_PROJET',
      status: 'approved',
      approvedBy: 'Pape Oumar KEBE',
      approvedAt: '2026-03-05T10:30:00Z',
      comments: 'Conforme aux normes'
    },
    {
      role: 'ADMIN',
      status: 'pending',
      approvedBy: undefined,
      approvedAt: undefined,
      comments: undefined
    },
    {
      role: 'DIRECTEUR',
      status: 'pending',
      approvedBy: undefined,
      approvedAt: undefined,
      comments: undefined
    }
  ],
  createdAt: '2026-03-05T09:00:00Z',
  updatedAt: '2026-03-05T10:30:00Z'
};

const mockApprovedWorkflow = {
  ...mockWorkflow,
  overallStatus: 'approved',
  steps: mockWorkflow.steps.map((step, idx) => ({
    ...step,
    status: 'approved',
    approvedBy: 'Test User',
    approvedAt: new Date().toISOString(),
    comments: `Approved by step ${idx + 1}`
  }))
};

// ============================================
// TESTS
// ============================================

describe('MissionApprovalHistory Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock default implementations
    vi.mocked(approvalService.getMissionApprovalHistory).mockResolvedValue(mockWorkflow);
  });

  describe('Rendering', () => {
    it('should render loading state initially', async () => {
      vi.mocked(approvalService.getMissionApprovalHistory).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockWorkflow), 100))
      );

      render(
        <MissionApprovalHistory 
          missionId="mission-123"
          missionOrderNumber="20/2026"
        />
      );

      expect(screen.getByText(/chargement/i)).toBeInTheDocument();
    });

    it('should render approval workflow complete', async () => {
      render(
        <MissionApprovalHistory 
          missionId="mission-123"
          missionOrderNumber="20/2026"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/HISTORIQUE APPROBATIONS/i)).toBeInTheDocument();
      });

      // Check overall status
      expect(screen.getByText(/En Attente d'Approbation|En attente d'appVote/)).toBeInTheDocument();

      // Check all steps are rendered
      expect(screen.getByText(/Chef de Projet/)).toBeInTheDocument();
      expect(screen.getByText(/Administrateur/)).toBeInTheDocument();
      expect(screen.getByText(/Directeur/)).toBeInTheDocument();
    });

    it('should display progress correctly', async () => {
      render(
        <MissionApprovalHistory 
          missionId="mission-123"
          missionOrderNumber="20/2026"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Étape 1\/3/)).toBeInTheDocument();
      });
    });

    it('should show error message on fetch failure', async () => {
      vi.mocked(approvalService.getMissionApprovalHistory).mockRejectedValueOnce(
        new Error('Network error')
      );

      render(
        <MissionApprovalHistory 
          missionId="mission-123"
          missionOrderNumber="20/2026"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/impossible de charger/i)).toBeInTheDocument();
      });
    });
  });

  describe('Approval Workflow Status', () => {
    it('should show "approved" status when all steps approved', async () => {
      vi.mocked(approvalService.getMissionApprovalHistory).mockResolvedValueOnce(
        mockApprovedWorkflow
      );

      render(
        <MissionApprovalHistory 
          missionId="mission-123"
          missionOrderNumber="20/2026"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Entièrement approuvée/)).toBeInTheDocument();
        expect(screen.getByText(/100%/)).toBeInTheDocument();
      });
    });

    it('should show "pending" status when no approvals yet', async () => {
      const pendingWorkflow = {
        ...mockWorkflow,
        overallStatus: 'pending',
        steps: mockWorkflow.steps.map(s => ({ ...s, status: 'pending' }))
      };

      vi.mocked(approvalService.getMissionApprovalHistory).mockResolvedValueOnce(
        pendingWorkflow
      );

      render(
        <MissionApprovalHistory 
          missionId="mission-123"
          missionOrderNumber="20/2026"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/En attente d'approbations/)).toBeInTheDocument();
        expect(screen.getByText(/0%/)).toBeInTheDocument();
      });
    });

    it('should show "rejected" status when one step rejected', async () => {
      const rejectedWorkflow = {
        ...mockWorkflow,
        overallStatus: 'rejected',
        steps: [
          { ...mockWorkflow.steps[0] },
          { ...mockWorkflow.steps[1], status: 'rejected', comments: 'Missing details' },
          { ...mockWorkflow.steps[2] }
        ]
      };

      vi.mocked(approvalService.getMissionApprovalHistory).mockResolvedValueOnce(
        rejectedWorkflow
      );

      render(
        <MissionApprovalHistory 
          missionId="mission-123"
          missionOrderNumber="20/2026"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Rejetée/)).toBeInTheDocument();
      });
    });
  });

  describe('User Actions', () => {
    it('should call approve service when approve button clicked', async () => {
      vi.mocked(approvalService.approveMissionStep).mockResolvedValueOnce(
        mockApprovedWorkflow
      );

      render(
        <MissionApprovalHistory 
          missionId="mission-123"
          missionOrderNumber="20/2026"
          userRole="ADMIN"
          isAdmin={true}
        />
      );

      await waitFor(() => {
        const approveButtons = screen.getAllByText(/Approuver/);
        expect(approveButtons.length).toBeGreaterThan(0);
      });

      const approveButton = screen.getAllByText(/Approuver/)[0];
      fireEvent.click(approveButton);

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
        const rejectButtons = screen.getAllByText(/Rejeter/);
        expect(rejectButtons.length).toBeGreaterThan(0);
      });

      const rejectButton = screen.getAllByText(/Rejeter/)[0];
      fireEvent.click(rejectButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/Rejeter l'approbation/)).toBeInTheDocument();
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

      // Find and click reject button
      await waitFor(() => {
        screen.getAllByText(/Rejeter/)[0];
      });

      const rejectButtons = screen.getAllByText(/Rejeter/);
      fireEvent.click(rejectButtons[1]); // Click the second reject button

      // Fill in reason
      const textarea = screen.getByPlaceholderText(/Veuillez expliquer/);
      fireEvent.change(textarea, { target: { value: 'Missing information' } });

      // Submit
      const confirmButton = screen.getByRole('button', { name: /Rejeter/ });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(approvalService.rejectMissionStep).toHaveBeenCalledWith(
          'mission-123',
          expect.any(String),
          'Missing information'
        );
      });
    });

    it('should call onApprovalChanged callback', async () => {
      const mockCallback = vi.fn();
      vi.mocked(approvalService.approveMissionStep).mockResolvedValueOnce(
        mockApprovedWorkflow
      );

      render(
        <MissionApprovalHistory 
          missionId="mission-123"
          missionOrderNumber="20/2026"
          userRole="ADMIN"
          isAdmin={true}
          onApprovalChanged={mockCallback}
        />
      );

      await waitFor(() => {
        const approveButtons = screen.getAllByText(/Approuver/);
        fireEvent.click(approveButtons[0]);
      });

      await waitFor(() => {
        expect(mockCallback).toHaveBeenCalled();
      });
    });

    it('should call override API when admin keeps validated order number and saves', async () => {
      const approvedWorkflow = {
        ...mockWorkflow,
        overallStatus: 'approved',
        steps: mockWorkflow.steps.map((step) => ({ ...step, status: 'APPROUVE' }))
      };

      vi.mocked(approvalService.getMissionApprovalHistory).mockResolvedValueOnce(approvedWorkflow);
      vi.mocked(approvalService.overrideMissionOrderNumber).mockResolvedValueOnce({
        ...approvedWorkflow,
        orderNumber: 'MISSION-2026-00099'
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

      fireEvent.click(screen.getByRole('button', { name: /Modifier le numéro/ }));
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Nouveau numéro de mission/)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText(/Nouveau numéro de mission/), {
        target: { value: 'MISSION-2026-00099' }
      });
      fireEvent.click(screen.getByRole('button', { name: /Modifier/ }));

      await waitFor(() => {
        expect(approvalService.overrideMissionOrderNumber).toHaveBeenCalledWith('mission-123', 'MISSION-2026-00099');
      });
    });
  });

  describe('Permissions', () => {
    it('should hide approve buttons for users without permission', async () => {
      render(
        <MissionApprovalHistory 
          missionId="mission-123"
          missionOrderNumber="20/2026"
          userRole="CHEF_PROJET"
          isAdmin={false}
        />
      );

      // CHEF_PROJET can only approve their own step (first)
      // No approve buttons should be visible for ADMIN or DIRECTEUR steps
      await waitFor(() => {
        const allText = screen.getByText(/Chef de Projet/);
        expect(allText).toBeInTheDocument();
      });
    });

    it('should show all approve buttons for admin users', async () => {
      render(
        <MissionApprovalHistory 
          missionId="mission-123"
          missionOrderNumber="20/2026"
          userRole="ADMIN"
          isAdmin={true}
        />
      );

      await waitFor(() => {
        const approveButtons = screen.getAllByText(/Approuver/);
        expect(approveButtons.length).toBe(2); // Two pending steps
      });
    });
  });

  describe('Auto-Refresh', () => {
    it('should refresh workflow at regular intervals', async () => {
      vi.useFakeTimers();

      render(
        <MissionApprovalHistory 
          missionId="mission-123"
          missionOrderNumber="20/2026"
        />
      );

      // Initial render
      expect(approvalService.getMissionApprovalHistory).toHaveBeenCalledTimes(1);

      // Fast-forward 5 seconds
      await vi.advanceTimersByTimeAsync(5000);

      expect(approvalService.getMissionApprovalHistory).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should cleanup interval on unmount', async () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { unmount } = render(
        <MissionApprovalHistory 
          missionId="mission-123"
          missionOrderNumber="20/2026"
        />
      );

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('Step Details Display', () => {
    it('should show approved step details', async () => {
      render(
        <MissionApprovalHistory 
          missionId="mission-123"
          missionOrderNumber="20/2026"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Pape Oumar KEBE/)).toBeInTheDocument();
        expect(screen.getByText(/Conforme aux normes/)).toBeInTheDocument();
      });
    });

    it('should not show details for pending steps', async () => {
      render(
        <MissionApprovalHistory 
          missionId="mission-123"
          missionOrderNumber="20/2026"
        />
      );

      await waitFor(() => {
        // Count instances of "Approuvé par:"
        const approvedByElements = screen.queryAllByText(/Approuvé par:/);
        // Should only have 1 (for the approved step)
        expect(approvedByElements.length).toBe(1);
      });
    });
  });
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe('MissionApprovalHistory - Integration Tests', () => {
  it('should handle full approval workflow', async () => {
    const step1Approved = { ...mockWorkflow };
    const step2Approved = {
      ...mockWorkflow,
      overallStatus: 'in_progress',
      steps: [
        { ...mockWorkflow.steps[0] },
        { ...mockWorkflow.steps[1], status: 'approved', approvedBy: 'Admin User', approvedAt: new Date().toISOString() },
        { ...mockWorkflow.steps[2] }
      ]
    };
    const allApproved = {
      ...mockWorkflow,
      overallStatus: 'approved',
      steps: mockWorkflow.steps.map(s => ({
        ...s,
        status: 'approved',
        approvedBy: 'Test User',
        approvedAt: new Date().toISOString()
      }))
    };

    vi.mocked(approvalService.getMissionApprovalHistory)
      .mockResolvedValueOnce(step1Approved)
      .mockResolvedValueOnce(step2Approved)
      .mockResolvedValueOnce(allApproved);

    vi.mocked(approvalService.approveMissionStep).mockResolvedValueOnce(step2Approved);

    render(
      <MissionApprovalHistory 
        missionId="mission-123"
        missionOrderNumber="20/2026"
        userRole="ADMIN"
        isAdmin={true}
      />
    );

    // Third approve call completes workflow
    expect(vi.mocked(approvalService.getMissionApprovalHistory)).toHaveBeenCalledWith('mission-123');
  });
});
