from abc import ABC, abstractmethod
from typing import Optional
from .jobs import Job

class IExecutionEngine(ABC):
    """Abstract interface for Execution Engines (Thread, Process, Distributed)."""
    
    @abstractmethod
    def submit(self, job: Job) -> str:
        """Submits a job for execution and returns its ID."""
        pass
        
    @abstractmethod
    def cancel(self, job_id: str):
        """Cancels a running job."""
        pass
        
    @abstractmethod
    def get_job(self, job_id: str) -> Optional[Job]:
        """Retrieves job state."""
        pass
        
    @abstractmethod
    def shutdown(self):
        """Shuts down the execution engine gracefully."""
        pass
