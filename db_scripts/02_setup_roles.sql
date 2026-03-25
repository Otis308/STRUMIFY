
--Create a role 
create ROLE team_tech;
create ROLE team_sales;
create ROLE team_intern;

--Grant permission to operate
grant connect on Database GuitarShop to team_tech;
grant connect on Database GuitarShop to team_sales;
grant connect on Database GuitarShop to team_intern;

--Detailed authorization
grant all privileges on all tables in schema public to team_tech;
grant create on schema public to team_tech;
grant select on all tables in schema public to team_sales;
grant select on all tables in schema public to team_intern;

--Create user
create user jos_lead with password 'tech@111';
grant team_tech to jos_lead;
create user mike_sales with password 'sales@222';
grant team_sales to mike_sales;
create user tom_intern with password 'intern@333';
grant team_intern to tom_intern;

