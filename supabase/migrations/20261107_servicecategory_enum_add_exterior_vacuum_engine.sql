-- The day sheet supports Exterior, Vacuum and Engine Wash as service
-- categories (exterior as a standalone wash, vacuum/engine as add-ons or
-- standalone jobs), but the PostgreSQL servicecategory enum only listed the
-- original vehicle categories. Adding the missing values prevents "invalid
-- input value for enum servicecategory" 500 errors when saving an exterior /
-- vacuum / engine job.
ALTER TYPE servicecategory ADD VALUE 'EXTERIOR';
ALTER TYPE servicecategory ADD VALUE 'VACUUM';
ALTER TYPE servicecategory ADD VALUE 'ENGINE';
