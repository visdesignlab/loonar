Store Location and Naming Conventions:

We separate our datastores based on the source that is affected when actions are taken.

For example, a store may expose actions that are called in several components. But if the actions take produce side effects in only one component, that would be considered a "component store". Similarly, actions taken which alter data initialized, it would be included in the data store.

Component Stores

- If your store is used mostly for interaction with a specific component

Data Stores

- Used for initializing and choosing datasets/locations

User interaction

- Stores which handle general user interactions, such as viewing images, selecting or deselections in the UI, etc

Misc

- All stores which are rarely accessed and do not fall into these other categories.