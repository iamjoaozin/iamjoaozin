import threading
from typing import Dict, Optional
from .jobs import Job, JobStatus
from .execution import IExecutionEngine
from ..bus import EventBus, Event, EventTypes

class ThreadExecutionEngine(IExecutionEngine):
    """Local execution engine using threads for async operations."""
    
    def __init__(self, event_bus: EventBus):
        self.event_bus = event_bus
        self._jobs: Dict[str, Job] = {}
        self._threads: Dict[str, threading.Thread] = {}
        self._lock = threading.RLock()
        
    def submit(self, job: Job) -> str:
        with self._lock:
            self._jobs[job.id] = job
            job.status = JobStatus.PENDING
            
        thread = threading.Thread(target=self._run_job, args=(job,))
        thread.daemon = True
        
        with self._lock:
            self._threads[job.id] = thread
            
        thread.start()
        
        self.event_bus.publish_async(Event(type=EventTypes.JOB_CREATED, payload={"job": job}))
        return job.id
        
    def _run_job(self, job: Job):
        try:
            with self._lock:
                job.status = JobStatus.RUNNING
            self.event_bus.publish_async(Event(type=EventTypes.JOB_PROGRESS, payload={"job": job}))
            
            # Execute target
            result = job.target(*job.args, **job.kwargs)
            
            with self._lock:
                job.status = JobStatus.COMPLETED
                job.result = result
        except Exception as e:
            with self._lock:
                job.status = JobStatus.FAILED
                job.error = e
        finally:
            self.event_bus.publish_async(Event(type=EventTypes.JOB_PROGRESS, payload={"job": job}))
            
    def cancel(self, job_id: str):
        """Marks a job as cancelled. Note: Cooperative cancellation required in job target."""
        with self._lock:
            if job_id in self._jobs and self._jobs[job_id].status == JobStatus.RUNNING:
                self._jobs[job_id].status = JobStatus.CANCELLED
                
    def get_job(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)
            
    def shutdown(self):
        """Wait for pending threads (stub)."""
        pass
